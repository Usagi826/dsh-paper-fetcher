/**
 * Pure, IO-free helpers shared by the Host resolver and its tests.
 *
 * Everything here mirrors the `download_paper` skill rules:
 *  - file name format `{year} - {venue} - {title}.pdf`
 *  - Windows-forbidden characters replaced by ` - `
 *  - preprint sources are named after the source that was actually used
 */

/** Characters Windows rejects in a file name segment. */
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Reserved DOS device names, unusable as a file name stem. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Trim a candidate path segment and make it safe on Windows and macOS.
 * @param raw - untrusted text (title, venue, author …).
 * @param maxLength - hard cap so `MAX_PATH` stays comfortable.
 * @returns a non-empty, filesystem-safe segment, or an empty string.
 */
export function safeNamePart(raw, maxLength = 140) {
  let text = String(raw ?? '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(FORBIDDEN, ' - ');
  text = text.replace(/\s*-\s*-\s*/g, ' - ');
  text = text.replace(/ {2,}/g, ' ');
  text = text.replace(/^[\s.\-]+/, '').replace(/[\s.\-]+$/, '');
  if (text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    text = (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
  }
  if (RESERVED.test(text)) text = `_${text}`;
  return text;
}

/**
 * Build the archive file name for one downloaded PDF.
 * @param paper - `{ year, venue, title }` as far as known.
 * @param options.suffix - `author-manuscript` / `preprint` mark for non-final versions.
 * @returns `{year} - {abbreviated journal} - {title}[ (suffix)].pdf`.
 *
 * Journal abbreviations keep their inner periods ("Nat. Neurosci."); Windows
 * forbids a period at the end of a segment, so only that final one is dropped.
 */
export function buildFileName(paper, options = {}) {
  const year = /^\d{4}$/.test(String(paper?.year ?? '')) ? String(paper.year) : '';
  // The venue keeps its inner periods ("Nat. Neurosci"); only a trailing period
  // is dropped, because Windows cannot store one at the end of a segment.
  const venue = safeNamePart(paper?.venue ?? '', 80).replace(/\.+$/, '');
  let title = safeNamePart(paper?.title ?? '', 140);
  if (title === '') title = 'Untitled paper';
  const parts = [year, venue].filter((part) => part !== '');
  const suffix = options.suffix ? safeNamePart(`(${options.suffix})`, 40) : '';
  const stem = [...parts, title].join(' - ');
  return `${suffix ? `${stem} ${suffix}` : stem}.pdf`.slice(0, 240);
}

/**
 * Recognise a bare DOI (with or without the `https://doi.org/` prefix).
 * @param text - user input.
 * @returns the normalised DOI, or null.
 */
export function parseDoi(text) {
  const trimmed = String(text ?? '').trim().replace(/^doi\s*[:：]\s*/i, '');
  const match = /^(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[^\s"'<>]+)$/i.exec(trimmed);
  if (match === null) return null;
  return match[1].replace(/[.,;]+$/, '');
}

/**
 * Recognise an arXiv reference: an id, an `arXiv:xxxx` label, or an abs/pdf URL.
 * @param text - user input.
 * @returns `{ id, version }` with a version-free id when recognised, else null.
 */
export function parseArxiv(text) {
  const trimmed = String(text ?? '').trim().replace(/^arxiv\s*:\s*/i, '');
  const url = /^(?:https?:\/\/(?:www\.|export\.)?arxiv\.org\/(?:abs|pdf)\/)?(.+?)(?:\.pdf)?\/?$/i.exec(trimmed);
  const candidate = url?.[1];
  if (candidate === undefined) return null;
  const match = /^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?$/i.exec(candidate);
  if (match === null) return null;
  return { id: match[1], version: match[2] ?? '' };
}

/** A DOI anywhere inside a line: reference lists embed them mid-sentence. */
const DOI_INLINE = /10\.\d{4,9}\/[^\s"'<>,;)\]]+/gi;

/** An arXiv id inside a line, with or without the `arXiv:` label or URL. */
const ARXIV_INLINE = /(?:\barxiv\s*[:.]?\s*|\/abs\/|\/pdf\/)(\d{4}\.\d{4,5}(?:v\d+)?)\b/gi;

/**
 * A leading list marker: "1.", "2)", "[3]", "-", "•".
 * A DOI starts with "10." as well, so a bare number is only a marker when the
 * text after it cannot continue a DOI (i.e. not "10.1038/…").
 */
const LIST_MARKER = /^\s*(?:\[\d+\]|\(\d+\)|\d+[.)、](?!\d*\s*\/)|[-*•·–—])\s*/;

/** Sentence-final punctuation glued to a title must not end up in the query. */
const TRAILING_PUNCTUATION = /[\s.,;:]+$/;

/**
 * Split pasted text into individual literature entries.
 *
 * The rule is one entry per line, because that is how people paste. A line is
 * reduced to its DOI or arXiv id when it has one, so a full reference
 * ("… Nat Neurosci. 2026;29:123. doi:10.1038/…") still resolves precisely.
 * A single line holding several DOIs is split further. A line is only split on
 * periods when every fragment still looks like a complete title, which keeps
 * "Attention is all you need. A transformer study" intact.
 *
 * @param text - one query or a pasted list of them.
 * @param options.limit - maximum number of entries to keep (default 50).
 * @returns `{ entries, truncated }`, entries being `{ query, kind }` where kind
 *   is `'doi' | 'arxiv' | 'title' | 'url'`.
 */
export function splitReferences(text, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 50;
  const raw = String(text ?? '').replace(/\r\n?/g, '\n');
  const lines = raw.split('\n')
    .map((line) => line.replace(LIST_MARKER, '').trim())
    .filter((line) => line !== '');

  const entries = [];
  const push = (query, kind) => {
    const value = String(query ?? '').trim();
    if (value === '') return;
    const key = value.toLowerCase();
    if (entries.some((entry) => entry.key === key)) return;
    entries.push({ key, query: value, kind });
  };

  for (const line of lines) {
    // 1. URLs first: a PDF link is used as-is.
    const urls = [...line.matchAll(/https?:\/\/\S+/gi)].map((match) => match[0].replace(/[.,;)\]]+$/, ''));
    if (urls.length > 0 && /\.pdf(?:$|\?)/i.test(urls[0])) {
      for (const url of urls) push(url, 'url');
      continue;
    }

    // 2. DOIs, which identify an article exactly.
    const dois = [...line.matchAll(DOI_INLINE)].map((match) => match[0].replace(/[.,;)\]]+$/, ''));
    if (dois.length > 0) {
      for (const doi of dois) push(doi, 'doi');
      continue;
    }

    // 3. arXiv ids.
    const arxiv = [...line.matchAll(ARXIV_INLINE)].map((match) => match[1]);
    if (arxiv.length > 0) {
      for (const id of arxiv) push(id, 'arxiv');
      continue;
    }

    // 4. Otherwise the whole line is a title. Split on sentence periods only
    //    when each fragment is long enough to stand as its own title.
    const fragments = line.split(/(?<=[.?!])\s+/).map((part) => part.replace(TRAILING_PUNCTUATION, '').trim()).filter(Boolean);
    if (fragments.length > 1 && fragments.every((part) => titleWords(part) >= 3)) {
      for (const part of fragments) push(part, 'title');
      continue;
    }
    push(line.replace(TRAILING_PUNCTUATION, '').trim(), 'title');
  }

  const truncated = entries.length > limit;
  return { entries: entries.slice(0, limit).map(({ query, kind }) => ({ query, kind })), truncated };
}

/**
 * Recognise a PDF URL supplied directly by the user.
 * @param text - user input.
 * @returns the URL when it ends in `.pdf`, else null.
 */
export function parsePdfUrl(text) {  const trimmed = String(text ?? '').trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  if (!/\.pdf(?:$|\?)/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Detect the PDF magic number.
 * @param head - first bytes of the payload.
 * @returns whether the payload starts with `%PDF-`.
 */
export function isPdfHeader(head) {
  return head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
}

/**
 * Decide whether a downloaded payload is a usable PDF.
 * @param head - first bytes of the payload.
 * @param size - payload length in bytes.
 * @returns null when valid, else a short failure reason.
 */
export function pdfProblem(head, size) {
  if (!isPdfHeader(head)) {
    const text = Buffer.from(head).toString('latin1').trimStart().toLowerCase();
    if (text.startsWith('<!doc') || text.startsWith('<html') || text.startsWith('<?xml')) {
      return 'the server returned an HTML page instead of a PDF (publisher block, bot challenge or paywall)';
    }
    return 'the response is not a PDF';
  }
  if (size < 20 * 1024) return `the PDF is truncated (${size} bytes)`;
  return null;
}

/**
 * Count the pages of a PDF well enough to reject an "abstract landing page" file.
 *
 * The page tree carries `/Count n` for the whole document (and for each node),
 * so the largest value is the page count; a linearized file also records `/N n`.
 * Object streams are inflated when they are plain zlib, so compressed page trees
 * still answer.
 * @param bytes - the complete PDF.
 * @param inflate - decompressor for FlateDecode payloads.
 * @returns the page count, or 0 when the structure could not be read.
 */
export function pdfPageCount(bytes, inflate) {
  const text = Buffer.from(bytes).toString('latin1');
  let pages = 0;
  for (const match of text.matchAll(/\/Count\s+(\d+)/g)) pages = Math.max(pages, Number(match[1]));
  const linear = /\/Linearized[^>]*?\/N\s+(\d+)/.exec(text);
  if (linear !== null) pages = Math.max(pages, Number(linear[1]));
  if (pages > 0) return pages;
  if (typeof inflate !== 'function') return 0;
  let objectStreamPages = 0;
  for (const match of text.matchAll(/(\d+)\s+0\s+obj\s*<<([\s\S]{0,600}?)>>\s*stream\r?\n/g)) {
    if (!/FlateDecode/.test(match[2]) || !/\/ObjStm/.test(match[2])) continue;
    const start = match.index + match[0].length;
    const end = text.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      const body = Buffer.from(inflate(bytes.subarray(start, end))).toString('latin1');
      objectStreamPages += (body.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    } catch {
      // A stream that is not plain zlib tells us nothing; the next one may.
    }
  }
  return objectStreamPages;
}

/**
 * Extract DOIs from the first bytes of a PDF when they are stored uncompressed.
 * The first hit often carries random binary tails, so callers should compare
 * with `doiMatches` rather than for equality.
 * @param head - first bytes of the payload.
 * @returns every DOI-looking string found, in order of appearance.
 */
export function doisFromPdfHead(head) {
  const text = Buffer.from(head).toString('latin1');
  const found = [];
  for (const match of text.matchAll(/(?:doi\s*[:/]\s*|doi\.org\/)(10\.\d{4,9}\/[^\s<>"'\\]+)/gi)) {
    const value = match[1].replace(/[.,;)\]]+$/, '');
    if (!found.includes(value)) found.push(value);
  }
  return found;
}

/**
 * Whether a DOI read from a PDF belongs to the expected record.
 * @param expected - the DOI the result is about.
 * @param found - a DOI read from the downloaded file.
 * @returns true when `found` starts with `expected` (ignoring case and trailing junk).
 */
export function doiMatches(expected, found) {
  const left = normalizeDoi(expected);
  const right = normalizeDoi(found);
  if (left === null || right === null) return false;
  return right === left || right.startsWith(left) || left.startsWith(right);
}

/**
 * Extract a DOI from the first bytes of a PDF when it is stored uncompressed.
 * @param head - first bytes of the payload.
 * @returns the DOI found first in the metadata, or null.
 */
export function doiFromPdfHead(head) {
  return doisFromPdfHead(head)[0] ?? null;
}

/**
 * Normalise a DOI for comparisons.
 * @param doi - any DOI spelling, with or without the resolver prefix.
 * @returns the lower-case DOI, or null.
 */
export function normalizeDoi(doi) {
  const match = /(10\.\d{4,9}\/[^\s"']+)/i.exec(String(doi ?? ''));
  return match === null ? null : match[1].toLowerCase();
}

/**
 * Pick a readable venue name from an Unpaywall / Crossref record.
 * @param record - journal, publisher, or conference metadata.
 * @returns the venue label, or an empty string.
 */
export function venueOf(record) {
  if (record === null || typeof record !== 'object') return '';
  const journal = typeof record.journal_name === 'string' ? record.journal_name.trim() : '';
  if (journal !== '') return journal;
  const container = Array.isArray(record.container)
    ? record.container.map((item) => item?.title).find((title) => typeof title === 'string' && title.trim() !== '')
    : '';
  if (typeof container === 'string' && container.trim() !== '') return container.trim();
  const proceedings = record['container-title'] ?? record.containerTitle;
  if (typeof proceedings === 'string' && proceedings.trim() !== '') return proceedings.trim();
  const publisher = typeof record.publisher === 'string' ? record.publisher.trim() : '';
  return publisher;
}

/**
 * Pick a title from an OpenAlex / Crossref / S2 style record.
 * @param record - metadata object.
 * @returns the trimmed title, or an empty string.
 */
export function titleOf(record) {
  if (record === null || typeof record !== 'object') return '';
  const value = record.title ?? record.display_name ?? record.displayName;
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (Array.isArray(record.title) && typeof record.title[0] === 'string') return record.title[0].trim();
  return '';
}

/**
 * Pick a publication year from a record.
 * @param record - metadata object.
 * @returns the four-digit year, or an empty string.
 */
export function yearOf(record) {
  if (record === null || typeof record !== 'object') return '';
  const candidates = [record.year, record.publication_year, record.publicationDate, record.issued, record.published];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && candidate > 1800 && candidate < 2200) return String(candidate);
    if (typeof candidate === 'string') {
      const match = /(1[89]\d\d|20\d\d|21\d\d)/.exec(candidate);
      if (match !== null) return match[1];
    }
    if (candidate !== null && typeof candidate === 'object') {
      const parts = candidate['date-parts'] ?? candidate.date_parts;
      if (Array.isArray(parts) && Array.isArray(parts[0]) && typeof parts[0][0] === 'number') {
        return String(parts[0][0]);
      }
    }
  }
  return '';
}

/**
 * Build a candidate list from Unpaywall's `oa_locations`.
 * @param payload - Unpaywall v2 response.
 * @returns every `url_for_pdf` in preference order, de-duplicated.
 */
export function unpaywallPdfUrls(payload) {
  const urls = [];
  const push = (url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url) && !urls.includes(url)) urls.push(url);
  };
  push(payload?.best_oa_location?.url_for_pdf);
  push(payload?.best_oa_location?.url);
  for (const location of Array.isArray(payload?.oa_locations) ? payload.oa_locations : []) {
    push(location?.url_for_pdf);
  }
  // Landing pages are weaker candidates; keep them as a last resort.
  const fallback = [];
  for (const location of Array.isArray(payload?.oa_locations) ? payload.oa_locations : []) {
    if (typeof location?.url === 'string' && /^https?:\/\//i.test(location.url) && !urls.includes(location.url)) {
      fallback.push(location.url);
    }
  }
  return [...urls, ...fallback];
}

/**
 * Rank doi.org / publisher landing pages harvested from HTML for the manual
 * fallback list.
 * @param html - page source.
 * @param base - page URL used to resolve relative links.
 * @param limit - maximum number of links.
 * @returns absolute PDF-looking links, best first.
 */
export function harvestPdfLinks(html, base, limit = 6) {
  const found = [];
  const push = (value) => {
    let url;
    try {
      url = new URL(String(value).replace(/&amp;/g, '&'), base).toString();
    } catch {
      return;
    }
    if (!/^https?:\/\//i.test(url)) return;
    if (!/\.pdf(?:$|\?)/i.test(url) && !/pdf/i.test(url)) return;
    if (!found.includes(url)) found.push(url);
  };
  const meta = /<meta[^>]+name=["']citation_pdf_url["'][^>]*content=["']([^"']+)["']/gi;
  const meta2 = /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']citation_pdf_url["']/gi;
  const anchors = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  for (const pattern of [meta, meta2]) {
    let match;
    while ((match = pattern.exec(html)) !== null) push(match[1]);
  }
  let match;
  while ((match = anchors.exec(html)) !== null) {
    const href = match[1];
    if (/\.pdf(?:$|\?|#)/i.test(href) || /pdf/i.test(href)) push(href);
  }
  return found.slice(0, limit);
}

/**
 * Lower-case, de-accented word list for title similarity.
 * @param text - title text.
 * @returns comparable words.
 */
export function titleWords(text) {
  const raw = String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  // Chinese has no spaces, so a CJK run is cut into overlapping bigrams; without
  // this every Chinese title would normalise to an empty word list and score 0.
  const tokens = [];
  for (const run of raw.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+|[a-z0-9]+/g) ?? []) {
    if (/^[a-z0-9]+$/.test(run)) {
      if (run.length > 1) tokens.push(run);
      continue;
    }
    if (run.length === 1) tokens.push(run);
    else for (let i = 0; i + 1 < run.length; i += 1) tokens.push(run.slice(i, i + 2));
  }
  return tokens;
}

/**
 * Score how well a candidate record matches the user's query title.
 * An identical title wins outright; a title that only contains the query as a
 * fragment is demoted, and so are datasets, corrections and other records that
 * are not a paper.
 * @param queryTitle - title typed by the user.
 * @param candidateTitle - title of the candidate record.
 * @param options.kind - Crossref/S2 type, used to demote non-paper records.
 * @returns 0…1 rank score.
 */
export function titleScore(queryTitle, candidateTitle, options = {}) {
  const query = titleWords(queryTitle);
  const words = titleWords(candidateTitle);
  if (query.length === 0 || words.length === 0) return 0;
  const same = query.length === words.length && query.every((word, index) => word === words[index]);
  let base;
  if (same) {
    base = 1;
  } else {
    const candidate = new Set(words);
    let hit = 0;
    for (const word of query) if (candidate.has(word)) hit += 1;
    const coverage = hit / query.length;
    const precision = hit / words.length;
    base = coverage * 0.5 + precision * 0.5;
    if (words.length > query.length + 1 && coverage >= 0.999) base = Math.min(base, 0.5);
  }
  const kind = String(options.kind ?? '').toLowerCase();
  const penalty = /dataset|posted-content|peer-review|erratum|correction|component|grant|other/.test(kind) ? 0.8 : 1;
  return base * penalty;
}

/**
 * Parse the entries of an arXiv Atom feed.
 * @param xml - `export.arxiv.org/api/query` response body.
 * @returns `{ id, title, year, abstract }` rows, in feed order.
 */
export function parseArxivFeed(xml) {
  const rows = [];
  const entries = String(xml ?? '').match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const entry of entries) {
    const id = /<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/.exec(entry)?.[1] ?? '';
    const titles = [...entry.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((match) => match[1].replace(/\s+/g, ' ').trim());
    const title = titles[0] ?? '';
    const year = /<published>(\d{4})/.exec(entry)?.[1] ?? '';
    const summary = /<summary>([\s\S]*?)<\/summary>/.exec(entry)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
    if (id !== '' && title !== '') rows.push({ id: id.replace(/v\d+$/, ''), title, year, abstract: summary.slice(0, 1200) });
  }
  return rows;
}

/**
 * Extract a DOI from a PDF when it appears in the uncompressed header bytes.
 * @param bytes - leading payload bytes.
 * @param notFound - DOI to report when none is visible in a zlib-stored stream.
 * @returns DOI candidates found in the payload.
 */
export function doisInPdf(bytes) {
  const text = Buffer.from(bytes).toString('latin1');
  const found = new Set();
  for (const match of text.matchAll(/(?:doi\s*[:/]\s*|doi\.org\/)(10\.\d{4,9}\/[^\s<>"'\\]+)/gi)) {
    found.add(match[1].replace(/[.,;)\]}>]+$/, '').toLowerCase());
  }
  return [...found];
}


/**
 * A source that cannot be automated but a human can open in a browser.
 * @param url - landing page.
 * @param label - short human label for the reason.
 * @returns the hint pair used by the resolver's fallback list.
 */
export function manualHint(url, label) {
  return { url, label };
}
