/**
 * Host half of `dsh-paper-fetcher`.
 *
 * Implements the `download_paper` skill as a service the panel calls:
 *   DOI / title → metadata (Crossref, OpenAlex, Semantic Scholar)
 *   → open-access PDF candidates (Unpaywall, S2, arXiv, bioRxiv, publisher page)
 *   → download and validate the PDF bytes
 *   → save as `{year} - {venue} - {title}.pdf` into the chosen folder.
 *
 * Dependency-free: Node built-ins plus the Harness public surfaces
 * (`webServer`, `connection`, `logger`). Every network call has a timeout so a
 * hanging publisher cannot stall the panel.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';

import {
  buildFileName,
  doiMatches,
  doisFromPdfHead,
  harvestPdfLinks,
  manualHint,
  normalizeDoi,
  parseArxiv,
  parseArxivFeed,
  parseDoi,
  parsePdfUrl,
  pdfPageCount,
  pdfProblem,
  splitReferences,
  titleOf,
  titleScore,
  titleWords,
  unpaywallPdfUrls,
  venueOf,
  yearOf,
} from './shared.js';
import { abbreviateJournal, normalizeAbbreviation } from './journal.js';

/** Row identity, matching cordis.patch.yml. */
export const name = 'dsh-paper-fetcher';

/** Route prefix owned by this plugin. */
const ROUTE_PREFIX = '/paper-download';

/** Polite User-Agent; some OA hosts reject the default Node agent. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Per-request limits. */
const METADATA_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 90_000;
const MAX_PDF_BYTES = 120 * 1024 * 1024;
const MAX_CANDIDATES = 10;

/** Fewer pages than this is an abstract, cover sheet or correction, not the article. */
const MIN_ARTICLE_PAGES = 3;

/**
 * How likely each source is to hand over a real PDF, measured over sample
 * downloads. The download loop tries the most reliable first, so the common case
 * finishes without walking the whole list.
 *
 * Observations behind the order: a Springer mirror answered with the full
 * article in ~3 s even where Unpaywall reported "not open"; publisher landing
 * pages answered in 3–7 s and usually returned HTML or 403.
 */
const SOURCE_RANK = {
  arxiv: 0,        // deterministic URL, a PDF or nothing
  publisher: 1,    // Springer mirror and citation_pdf_url links
  'open-access': 2,
  'semantic-scholar': 3,
  preprint: 4,
  direct: 5,
};

/** A candidate that never turns into a PDF should not hold the whole job. */
const CANDIDATE_TIMEOUT_MS = 20_000;

/** A pasted list is processed in one go; this bounds it. */
const MAX_BATCH_ITEMS = 50;

/**
 * Journal cache bundled with the plugin (`lib/journals.json`): curated
 * abbreviations for common journals plus a title→ISSN table harvested from the
 * Crossref journal index. It is loaded once and keyed case/punctuation-insensitively,
 * so "Nature neuroscience", "NATURE NEUROSCIENCE." and the title itself all hit.
 */
const JOURNAL_CACHE = (() => {
  try {
    const url = new URL('./journals.json', import.meta.url);
    const data = JSON.parse(fs.readFileSync(url, 'utf8'));
    const abbreviations = new Map();
    const issnByTitle = new Map();
    const titleByIssn = new Map();
    const key = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const [title, short] of Object.entries(data.abbreviations ?? {})) {
      abbreviations.set(key(title), short);
    }
    for (const row of data.issn ?? []) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const [, title, issn] = row;
      const k = key(title);
      if (!issnByTitle.has(k)) issnByTitle.set(k, issn);
      if (!titleByIssn.has(issn)) titleByIssn.set(issn, title);
    }
    return { abbreviations, issnByTitle, titleByIssn, size: issnByTitle.size };
  } catch {
    // A missing or unreadable cache only costs the offline fast path.
    return { abbreviations: new Map(), issnByTitle: new Map(), titleByIssn: new Map(), size: 0 };
  }
})();

/** Case/punctuation-insensitive key used by the journal cache. */
function journalKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Look up a bundled abbreviation.
 * @param title - full or partially written journal name.
 * @returns the curated abbreviation, or '' when the journal is not in the cache.
 */
function lookupCachedAbbreviation(title) {
  const key = journalKey(title);
  if (key === '') return '';
  const direct = JOURNAL_CACHE.abbreviations.get(key);
  if (direct !== undefined) return direct;
  // A prefix match handles "The Lancet" vs "Lancet" and trailing qualifiers.
  for (const [candidate, short] of JOURNAL_CACHE.abbreviations) {
    if (candidate.startsWith(key) && key.length >= 4) return short;
  }
  return '';
}

/** ISSN for a journal name, when the bundled table knows it. */
function cachedIssn(title) {
  return JOURNAL_CACHE.issnByTitle.get(journalKey(title)) ?? '';
}

/** Desktop is the default save directory (the skill's default as well). */
export function desktopDirectory() {
  const home = os.homedir();
  const candidates = [];
  const profile = process.env.USERPROFILE ?? '';
  if (process.platform === 'win32') {
    const userFolders = path.join(profile || home, 'Desktop');
    candidates.push(path.join(home, 'Desktop'), userFolders);
    // OneDrive-redirected desktop.
    if (process.env.OneDrive) candidates.push(path.join(process.env.OneDrive, 'Desktop'));
    if (process.env.OneDriveConsumer) candidates.push(path.join(process.env.OneDriveConsumer, 'Desktop'));
  } else {
    candidates.push(path.join(home, 'Desktop'));
  }
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // Try the next spelling.
    }
  }
  return candidates[0] ?? home;
}

/** Error carrying a user-facing code. */
function failure(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.extra = extra;
  return error;
}

/** Fetch with a hard timeout and the polite User-Agent. */
async function request(url, { accept = '*/*', timeout = METADATA_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept,
        'accept-language': 'en;q=0.9, zh-CN;q=0.8',
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Read a JSON response, returning null on any failure. */
async function getJson(url, options) {
  try {
    const response = await request(url, { accept: 'application/json', ...options });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** Read a text response, returning null on any failure. */
async function getText(url, options) {
  try {
    const response = await request(url, { accept: 'text/html,application/xhtml+xml', ...options });
    if (!response.ok) return null;
    const length = Number(response.headers.get('content-length') ?? '0');
    if (length > 3 * 1024 * 1024) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** Encode a DOI for a path segment without escaping its slash. */
function doiPath(doi) {
  return String(doi).split('/').map((part) => encodeURIComponent(part)).join('/');
}

/** Cross-API metadata container. */
function emptyMetadata() {
  return { doi: '', title: '', year: '', venue: '', venueShort: '', issn: '', authors: [], abstract: '', landingUrl: '' };
}

/** Merge a record into accumulated metadata without overwriting good values. */
function mergeMetadata(target, source) {
  if (source === null || typeof source !== 'object') return target;
  if (target.title === '' && titleOf(source) !== '') target.title = titleOf(source);
  if (target.year === '' && yearOf(source) !== '') target.year = yearOf(source);
  if (target.venue === '' && venueOf(source) !== '') target.venue = venueOf(source);
  if (target.abstract === '' && typeof source.abstract === 'string') target.abstract = source.abstract.slice(0, 1200);
  if (typeof source.url === 'string' && target.landingUrl === '') target.landingUrl = source.url;
  return target;
}

/** Search metadata by DOI across three free APIs. */
async function metadataFromDoi(doi) {
  const metadata = emptyMetadata();
  metadata.doi = doi;
  const [crossref, openalex, semantic] = await Promise.all([
    getJson(`https://api.crossref.org/works/${doiPath(doi)}`),
    getJson(`https://api.openalex.org/works/https://doi.org/${doiPath(doi)}`),
    getJson(
      `https://api.semanticscholar.org/graph/v1/paper/DOI:${doiPath(doi)}?fields=title,year,venue,publicationVenue,abstract,authors,externalIds`,
    ),
  ]);
  if (crossref?.message) {
    const record = crossref.message;
    if (record.title) metadata.title ||= Array.isArray(record.title) ? record.title[0] : record.title;
    const year = yearOf(record);
    if (year) metadata.year ||= year;
    if (record['container-title']) {
      const container = Array.isArray(record['container-title']) ? record['container-title'][0] : record['container-title'];
      if (typeof container === 'string' && container !== '') metadata.venue ||= container;
    }
    // Crossref usually carries the published abbreviation ("Nat Neurosci").
    const short = Array.isArray(record['short-container-title'])
      ? record['short-container-title'][0]
      : record['short-container-title'];
    if (typeof short === 'string' && short.trim() !== '') metadata.venueShort ||= short.trim();
    const issn = Array.isArray(record.ISSN) ? record.ISSN[0] : record.ISSN;
    if (typeof issn === 'string' && issn.trim() !== '') metadata.issn ||= issn.trim();
    metadata.venue ||= venueOf(record);
    if (Array.isArray(record.author)) {
      metadata.authors = record.author
        .map((author) => [author?.given, author?.family].filter(Boolean).join(' '))
        .filter((value) => typeof value === 'string' && value !== '');
    }
    if (typeof record.abstract === 'string') metadata.abstract ||= record.abstract.replace(/<[^>]+>/g, '').slice(0, 1200);
    if (typeof record.URL === 'string') metadata.landingUrl ||= record.URL;
  }
  if (openalex) {
    const record = openalex;
    if (metadata.title === '') metadata.title = titleOf(record);
    if (metadata.year === '') metadata.year = yearOf(record);
    if (metadata.venue === '') {
      const source = record.primary_location?.source;
      const location = source?.display_name;
      if (typeof location === 'string') metadata.venue = location;
      // OpenAlex exposes the journal ISSN; it identifies the real journal even
      // when the record only names the hosting platform.
      const issns = Array.isArray(source?.issn) ? source.issn : [];
      if (metadata.issn === '') {
        const candidate = typeof source?.issn_l === 'string' ? source.issn_l : issns[0];
        if (typeof candidate === 'string') metadata.issn = candidate;
      }
    }
    if (metadata.authors.length === 0 && Array.isArray(record.authorships)) {
      metadata.authors = record.authorships
        .map((entry) => entry?.author?.display_name)
        .filter((value) => typeof value === 'string');
    }
    if (metadata.abstract === '' && typeof record.abstract_inverted_index === 'object' && record.abstract_inverted_index !== null) {
      const positions = new Map();
      for (const [word, indexes] of Object.entries(record.abstract_inverted_index)) {
        for (const index of indexes) positions.set(index, word);
      }
      const ordered = [...positions.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
      metadata.abstract = ordered.join(' ').slice(0, 1200);
    }
  }
  if (semantic) {
    mergeMetadata(metadata, {
      title: semantic.title,
      year: semantic.year,
      venue: semantic.venue ?? semantic.publicationVenue?.name,
      abstract: semantic.abstract,
      url: semantic.url,
    });
    if (metadata.authors.length === 0 && Array.isArray(semantic.authors)) {
      metadata.authors = semantic.authors.map((author) => author?.name).filter((value) => typeof value === 'string');
    }
  }
  return metadata;
}

/** One comparison candidate from every metadata API. */
function candidatesFrom(payloads) {
  const seen = new Set();
  const rows = [];
  const push = (doi, record) => {
    const title = titleOf(record);
    if (title === '') return;
    const key = (normalizeDoi(doi ?? '') ?? title.toLowerCase()).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      doi: normalizeDoi(doi ?? record?.doi ?? record?.DOI ?? '') ?? '',
      title,
      year: yearOf(record),
      kind: typeof record?.type === 'string' ? record.type : '',
      venue: venueOf(record) || (typeof record?.primary_location?.source?.display_name === 'string'
        ? record.primary_location.source.display_name
        : ''),
      score: 0,
    });
  };
  for (const work of payloads.crossref ?? []) push(work?.DOI, work);
  for (const work of payloads.openalex ?? []) push(work?.doi, work);
  for (const paper of payloads.semantic ?? []) push(paper?.externalIds?.DOI, paper);
  return rows;
}

/** Search every metadata API by title and rank the candidates. */
async function searchByTitle(query) {
  const trimmed = query.trim();
  const encoded = encodeURIComponent(trimmed);
  const arxivQuery = encodeURIComponent(`ti:"${trimmed.replace(/"/g, '')}"`);
  const [crossref, openalex, arxivFeed] = await Promise.all([
    getJson(
      `https://api.crossref.org/works?query.bibliographic=${encoded}&rows=8&select=DOI,title,issued,container-title,author,type,abstract,publisher`,
    ),
    getJson(`https://api.openalex.org/works?search=${encoded}&per-page=8`),
    getText(`https://export.arxiv.org/api/query?search_query=${arxivQuery}&max_results=4`, {
      accept: 'application/atom+xml,application/xml',
    }),
  ]);
  const rows = candidatesFrom({
    crossref: crossref?.message?.items,
    openalex: openalex?.results,
    semantic: [],
  });
  for (const entry of parseArxivFeed(arxivFeed ?? '')) {
    if (rows.some((row) => titleWords(row.title).join(' ') === titleWords(entry.title).join(' '))) continue;
    rows.push({
      doi: '',
      arxiv: entry.id,
      title: entry.title,
      year: entry.year,
      venue: 'arXiv',
      abstract: entry.abstract,
      score: 0,
    });
  }
  for (const row of rows) row.score = titleScore(trimmed, row.title, { kind: row.kind });
  const codeBoost = (row) => {
    if (row.arxiv !== undefined && row.arxiv !== '') return 3;
    if (/^10\.48550\/arxiv\./i.test(row.doi)) return 3;
    if (row.doi !== '' && /journal-article|proceedings-article|conference-paper|review|posted-content/.test(String(row.kind ?? ''))) return 2;
    return 0;
  };
  rows.sort((left, right) => right.score - left.score || codeBoost(right) - codeBoost(left)
    || (Number(right.year) || 0) - (Number(left.year) || 0));
  // The arXiv copy of a record that also carries a DOI is the same paper.
  const arxivByTitle = new Map();
  for (const row of rows) {
    if (row.arxiv !== undefined && row.arxiv !== '') arxivByTitle.set(titleWords(row.title).join(' '), row.arxiv);
  }
  for (const row of rows) {
    if (row.arxiv === undefined || row.arxiv === '') {
      const twin = arxivByTitle.get(titleWords(row.title).join(' '));
      if (twin !== undefined) row.arxiv = twin;
    }
  }
  const crossrefByDoi = new Map();
  for (const work of Array.isArray(crossref?.message?.items) ? crossref.message.items : []) {
    const key = normalizeDoi(work?.DOI ?? '');
    if (key !== null) crossrefByDoi.set(key, work);
  }
  for (const row of rows) {
    const record = crossrefByDoi.get(row.doi);
    if (record === undefined) continue;
    row.kind = record.type ?? '';
    if (typeof record.abstract === 'string' && record.abstract.trim() !== '') {
      row.abstract = record.abstract.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
    }
    // Never fall back to `publisher`: that is the platform ("Springer Science and
    // Business Media LLC"), not the journal, and it must not reach the file name
    // or the details panel. The journal comes from container-title only.
  }
  return rows;
}

/** Preprint servers keyed by their DOI prefix. */
function preprintCandidates(doi) {
  const candidates = [];
  const bio = /^10\.1101\/(.+)$/i.exec(doi);
  if (bio !== null) {
    const slug = bio[1].replace(/\.(abstract|full|full\.pdf|pdf)$/i, '');
    for (let version = 4; version >= 1; version -= 1) {
      candidates.push(`https://www.biorxiv.org/content/10.1101/${slug}v${version}.full.pdf`);
    }
  }
  const chem = /^10\.26434\/(.+)$/i.exec(doi);
  if (chem !== null) candidates.push(`https://chemrxiv.org/engage/chemrxiv/article-details/${chem[1]}`);
  return candidates;
}

/**
 * Springer Nature publishes the same PDF on `link.springer.com`, which serves
 * it to scripts while `www.nature.com` redirects to a cookie wall. The file
 * name on disk should still name the journal, so the venue is kept.
 */
function springerCandidates(doi) {
  const candidates = [];
  if (/^10\.1038\//i.test(doi)) {
    candidates.push({ url: `https://link.springer.com/content/pdf/${doi}.pdf`, kind: 'publisher' });
  }
  return candidates;
}

/** Unpaywall + Semantic Scholar open-access links for one DOI. */
async function openAccessCandidates(doi, email) {
  const [unpaywall, semantic] = await Promise.all([
    getJson(`https://api.unpaywall.org/v2/${doiPath(doi)}?email=${encodeURIComponent(email)}`),
    getJson(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doiPath(doi)}?fields=openAccessPdf,externalIds`),
  ]);
  const candidates = [];
  for (const url of unpaywallPdfUrls(unpaywall)) candidates.push({ url, kind: 'open-access' });
  const s2 = semantic?.openAccessPdf?.url;
  if (typeof s2 === 'string' && s2 !== '') candidates.push({ url: s2, kind: 'semantic-scholar' });
  candidates.push(...springerCandidates(doi));
  // arXiv copy recorded by the metadata APIs.
  const arxivId = unpaywall?.oa_locations?.map((location) => /arxiv\.org\/abs\/(\S+)/i.exec(location?.url ?? '')?.[1])
    .find((value) => typeof value === 'string');
  const arxivDoi = /^10\.48550\/arxiv\.(.+)$/i.exec(doi)?.[1];
  for (const id of [arxivId, arxivDoi]) {
    if (typeof id === 'string' && id !== '') candidates.push({ url: `https://arxiv.org/pdf/${id.replace(/^arxiv\./i, '')}`, kind: 'arxiv' });
  }
  for (const url of preprintCandidates(doi)) candidates.push({ url, kind: 'preprint' });
  return candidates;
}

/**
 * Inspect a landing page for its `citation_pdf_url` and PDF anchors.
 *
 * Nature-style pages list supplementary PDFs too; a 2-page "supplementary
 * information" file is not the article, so obvious supplements are skipped
 * and the publisher PDF is tried first.
 */
async function landingCandidates(url) {
  const html = await getText(url, { timeout: METADATA_TIMEOUT_MS });
  if (html === null) return [];
  const links = harvestPdfLinks(html, url, 12);
  const supplementary = /supplement|moesm|esm|mediaobject|appendix|errata|correction|reviewer|peer-?review/i;
  const primary = links.filter((link) => !supplementary.test(link));
  return [...new Set(primary)].slice(0, 4).map((link) => ({ url: link, kind: 'publisher' }));
}

/**
 * Download one URL and validate that it is a real PDF.
 * @param url - candidate PDF address.
 * @param timeoutMs - how long this single candidate may take.
 */
async function fetchPdf(url, timeoutMs = DOWNLOAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(url, {
      accept: 'application/pdf,*/*',
      timeout: timeoutMs,
      headers: { 'sec-fetch-dest': 'document' },
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_PDF_BYTES) {
      return { ok: false, reason: `the file is larger than ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const problem = pdfProblem(buffer.subarray(0, 512), buffer.length);
    if (problem !== null) {
      return { ok: false, reason: `${problem}${contentType.includes('html') ? ' (text/html)' : ''}` };
    }
    // Validation is by magic number and size; a mislabelled content type is tolerated.
    return { ok: true, bytes: buffer, finalUrl: response.url || url };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'the download timed out' : String(error?.message ?? error);
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a collision-free target path. */
async function freePath(directory, fileName) {
  const extension = path.extname(fileName);
  const stem = fileName.slice(0, fileName.length - extension.length);
  for (let index = 0; index < 100; index += 1) {
    const candidate = path.join(directory, index === 0 ? fileName : `${stem} (${index + 1})${extension}`);
    try {
      await fsp.access(candidate);
    } catch {
      return candidate;
    }
  }
  return path.join(directory, `${stem} (${randomUUID().slice(0, 6)})${extension}`);
}

/** Suffix used when the best available copy is not the final published PDF. */
function versionSuffix(kind) {
  if (kind === 'arxiv' || kind === 'preprint') return 'preprint';
  return '';
}

/**
 * Venue label for the file name, reflecting the source that was actually used.
 * A publisher mirror of the same article still names its journal; a preprint
 * names the server it came from. Platform names such as "Springer Science and
 * Business Media LLC" or "Elsevier BV" are not journals, so they are dropped.
 */
/**
 * Publisher platform names are not journals; a file name must not use them.
 */
const PLATFORM_NAMES = /^(springer|elsevier|wiley|taylor\s*&?\s*francis|sage|informa|acs|ieee|oxford university press|informa uk limited|bmj|elsevier b\.?v\.?|john wiley\s*&\s*sons|ltd|inc)$/i;

function isPlatformName(value) {
  const text = String(value ?? '').trim();
  return text === '' || PLATFORM_NAMES.test(text)
    || /science and business media|elsevier b\.v|^springer\b.*\b(llc|ag)\b/i.test(text);
}

/**
 * Resolve the journal label used inside the file name, as an abbreviated title.
 *
 * Order of trust: the abbreviation the API already published, then the bundled
 * cache (curated abbreviations and title→ISSN), then the NLM word rules. The
 * full title is kept for display; only the file name uses the short form.
 * @param metadata - cross-API metadata, possibly with venueShort/issn.
 * @returns {{ full: string, short: string }} labels; either may be ''.
 */
/**
 * The journal identity of one record, shared by the file name and the details
 * panel so both always describe the same journal.
 * @param metadata - cross-API metadata (`venue`, `venueShort`, `issn`, `doi`).
 * @returns {{ full: string, short: string }} the journal's full name and its
 *   abbreviation; either may be '' when the journal is unknown.
 */
function journalNames(metadata) {
  const full = isPlatformName(metadata?.venue) ? '' : String(metadata?.venue ?? '').trim();
  const curated = lookupCachedAbbreviation(full);
  const published = normalizeAbbreviation(metadata?.venueShort, full);
  // A "short" title that equals the full title carries no information,
  // but it is still correct when the journal has a one-word name.
  const short = published !== '' && published !== full
    ? published
    : curated !== '' && curated !== full
      ? curated
      : abbreviateJournal(full);
  return { full, short };
}

/**
 * Replace a platform name with the real journal name.
 *
 * Crossref, OpenAlex and publisher pages sometimes report the *publisher*
 * ("Springer Science and Business Media LLC", "Elsevier BV") where the journal
 * belongs. The ISSN identifies the real journal, so it is asked first and the
 * abbreviation is then rebuilt from the corrected name.
 * @param metadata - mutated in place; `venue`, `venueShort`, `issn` are updated.
 * @returns the metadata, for chaining.
 */
function normalizeVenue(metadata) {
  if (metadata === null || typeof metadata !== 'object') return metadata;
  let venue = String(metadata.venue ?? '').trim();
  const issn = String(metadata.issn ?? '').trim();

  if (isPlatformName(venue) || venue === '') {
    const known = issn !== '' ? JOURNAL_CACHE.titleByIssn.get(issn) : undefined;
    if (typeof known === 'string' && known !== '') venue = known;
    else if (isPlatformName(venue)) venue = '';
  }

  metadata.venue = venue;
  metadata.issn = issn;

  // The details panel and the file name read these two fields, so the values
  // decided here are the single source of truth for both.
  const names = journalNames(metadata);
  metadata.venue = names.full;
  metadata.venueShort = names.short;
  return metadata;
}

/**
 * Venue label for the file name, reflecting the source that was actually used.
 * A publisher mirror of the same article still names its journal; a preprint
 * names the server it came from.
 */
function venueForSource(metadata, kind, url) {
  if (kind === 'arxiv' || /arxiv\.org/i.test(url)) return 'arXiv';
  if (kind === 'preprint') {
    if (/biorxiv\.org/i.test(url)) return 'bioRxiv';
    if (/medrxiv\.org/i.test(url)) return 'medRxiv';
    if (/chemrxiv\.org/i.test(url)) return 'chemRxiv';
    return 'Preprint';
  }
  const { full, short } = journalNames(metadata);
  if (short !== '') return short;
  if (full !== '') return full;
  // Fall back to the journal family implied by the DOI prefix.
  return /^10\.1038\//i.test(String(metadata?.doi ?? '')) ? 'Nature' : '';
}

/**
 * Decide the journal abbreviation for one record.
 *
 * 1. the abbreviation the metadata API already publishes;
 * 2. the curated table bundled with the plugin (no network);
 * 3. a Crossref lookup by DOI or ISSN, which returns the published short title;
 * 4. the NLM word rules as a last resort.
 *
 * @param metadata - cross-API metadata with `venue`, `doi`, `venueShort`, `issn`.
 * @returns the abbreviation, or '' when the journal is unknown.
 */
async function resolveJournalAbbreviation(metadata) {
  const full = isPlatformName(metadata?.venue) ? '' : String(metadata?.venue ?? '').trim();
  const published = normalizeAbbreviation(metadata?.venueShort, full);
  if (published !== '') return published;

  const curated = lookupCachedAbbreviation(full);
  if (curated !== '') return curated;

  // Ask Crossref for a work of this journal and read its short title.
  const issn = String(metadata?.issn ?? '').trim() || cachedIssn(full);
  if (issn !== '' || metadata?.doi) {
    const url = issn !== ''
      ? `https://api.crossref.org/journals/${encodeURIComponent(issn)}/works?rows=3&select=short-container-title,container-title`
      : `https://api.crossref.org/works/${doiPath(metadata.doi)}`;
    const payload = await getJson(url);
    const items = Array.isArray(payload?.message?.items)
      ? payload.message.items
      : payload?.message
        ? [payload.message]
        : [];
    for (const item of items) {
      const raw = Array.isArray(item?.['short-container-title'])
        ? item['short-container-title'][0]
        : item?.['short-container-title'];
      const found = normalizeAbbreviation(raw, full);
      if (found !== '') return found;
    }
  }

  return abbreviateJournal(full);
}

/**
 * The resolver: one public `resolve` operation used by the HTTP route.
 */
export class PaperResolver {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Run the whole pipeline for one query.
   * @param query - DOI, title, arXiv id, or PDF URL.
   * @param options - `{ directory, email }`.
   * @returns a JSON-serialisable search result.
   */
  async resolve(query, options = {}) {
    const started = Date.now();
    // Phase timings, printed to the Host log when DSH_PAPER_TRACE=1 is set.
    // They are kept because the slow part of a download is almost always one
    // remote host, and this is what makes that visible.
    const traceOn = process.env.DSH_PAPER_TRACE === '1';
    const marks = [];
    let markAt = started;
    const mark = (label) => {
      if (!traceOn) return;
      const now = Date.now();
      marks.push(`${label}=${now - markAt}`);
      markAt = now;
    };
    const finish = () => {
      if (traceOn) console.error(`[trace] total=${Date.now() - started} ${marks.join(' ')}`);
    };
    const text = String(query ?? '').trim();
    if (text === '') throw failure('empty-query', '请输入论文标题或 DOI');
    const directory = path.resolve(options.directory && String(options.directory).trim() !== ''
      ? String(options.directory)
      : desktopDirectory());
    const email = typeof options.email === 'string' && options.email.trim() !== '' ? options.email.trim() : 'paper-download@dsh.local';

    const result = {
      query: text,
      directory,
      status: 'failed',
      file: null,
      metadata: emptyMetadata(),
      tried: [],
      alternatives: [],
      manual: [],
      message: '',
      elapsedMs: 0,
    };

    // Classify the query.
    const directUrl = parsePdfUrl(text);
    const arxiv = directUrl === null ? parseArxiv(text) : null;
    const doi = directUrl === null && arxiv === null ? parseDoi(text) : null;

    let candidates = [];
    if (directUrl !== null) {
      result.metadata.title = decodeURIComponent(directUrl.split('/').pop() ?? '').replace(/\.pdf$/i, '');
      candidates = [{ url: directUrl, kind: 'direct' }];
    } else if (arxiv !== null) {
      result.metadata.arxiv = arxiv.id;
      candidates = [
        { url: `https://arxiv.org/pdf/${arxiv.id}${arxiv.version}`, kind: 'arxiv' },
        { url: `https://arxiv.org/pdf/${arxiv.id}`, kind: 'arxiv' },
      ];
      const feed = parseArxivFeed(await getText(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxiv.id)}`, {
        accept: 'application/atom+xml,application/xml',
      }) ?? '');
      const entry = feed[0];
      if (entry !== undefined) {
        result.metadata.title = entry.title;
        result.metadata.year = entry.year;
        result.metadata.venue = 'arXiv';
        result.metadata.abstract = entry.abstract;
        // Surface the published venue when the preprint has one.
        const published = await metadataFromDoi(`10.48550/arXiv.${entry.id}`);
        if (published.title !== '' && published.venue !== '' && !/arxiv/i.test(published.venue)) {
          result.metadata.published = { doi: published.doi, title: published.title, year: published.year, venue: published.venue };
        }
      }
    } else if (doi !== null) {
      const metadata = await metadataFromDoi(doi);
      mark('metadata');
      result.metadata = { ...result.metadata, ...metadata };
      if (result.metadata.title === '') {
        const rows = await searchByTitle(doi);
        const best = rows[0];
        if (best !== undefined) result.metadata.title = best.title;
      }
      candidates = await openAccessCandidates(doi, email);
      mark('oa-candidates');
    } else {
      // A title: rank metadata candidates, then resolve the best one.
      const rows = await searchByTitle(text);
      mark('search-by-title');
      result.alternatives = rows.slice(0, 5).map((row) => ({
        doi: row.doi,
        arxiv: row.arxiv ?? '',
        title: row.title,
        year: row.year,
        venue: row.venue,
        score: Math.round(row.score * 100),
      }));
      const best = rows.find((row) => row.score >= 0.7 && (row.doi !== '' || row.arxiv !== '')) ?? null;
      if (best === null) {
        result.message = '没有找到与标题足够匹配的论文元数据，可改用 DOI 重试。';
      } else if (best.doi === '' && best.arxiv !== '') {
        // A title that only exists on arXiv.
        result.metadata = { ...result.metadata, title: best.title, year: best.year, venue: 'arXiv', arxiv: best.arxiv, abstract: best.abstract ?? '' };
        candidates = [
          { url: `https://arxiv.org/pdf/${best.arxiv}`, kind: 'arxiv' },
          { url: `https://arxiv.org/pdf/${best.arxiv}v1`, kind: 'arxiv' },
        ];
      } else {
        result.metadata = {
          ...result.metadata,
          doi: best.doi,
          title: best.title,
          year: best.year,
          venue: best.venue,
          abstract: best.abstract ?? '',
        };
        if (best.arxiv) result.metadata.arxiv = best.arxiv;
        const metadata = await metadataFromDoi(best.doi);
        const merged = {};
        for (const [key, value] of Object.entries(metadata)) {
          if (key === 'title' || key === 'year' || key === 'venue' || key === 'abstract') continue;
          if (value !== '' && !(Array.isArray(value) && value.length === 0)) merged[key] = value;
        }
        result.metadata = { ...result.metadata, ...merged };
        if (result.metadata.abstract === '') result.metadata.abstract = metadata.abstract;
        candidates = await openAccessCandidates(best.doi, email);
        if (best.arxiv) candidates.unshift({ url: `https://arxiv.org/pdf/${best.arxiv}`, kind: 'arxiv' });
      }
    }

    // The publisher landing page is slow (3–7 s) and usually answers with HTML,
    // so it is only fetched when nothing else produced a PDF. Keeping it out of
    // the fast path is what makes a successful download take seconds.
    const landingUrl = result.metadata.doi
      ? `https://doi.org/${result.metadata.doi}`
      : result.metadata.landingUrl || '';
    const landingReady = landingUrl !== '';
    let landingFetched = false;
    const fetchLanding = async () => {
      if (!landingReady || landingFetched) return [];
      landingFetched = true;
      return landingCandidates(landingUrl);
    };

    // Most reliable sources first; the list is de-duplicated and capped after
    // sorting so a high-priority source is never crowded out.
    const seen = new Set();
    const unique = [];
    for (const candidate of candidates) {
      if (candidate.url === undefined || seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      unique.push(candidate);
    }
    unique.sort((left, right) => (SOURCE_RANK[left.kind] ?? 9) - (SOURCE_RANK[right.kind] ?? 9));
    candidates = unique.slice(0, MAX_CANDIDATES);

    // Repair the journal fields first (a publisher name must not survive), then
    // resolve the abbreviation, so the file name and the details panel agree.
    normalizeVenue(result.metadata);
    result.metadata.venueShort = await resolveJournalAbbreviation(result.metadata);
    normalizeVenue(result.metadata);
    mark('journal-abbrev');

    // Try each candidate in order. When the expected DOI is visible in the
    // PDF, a mismatching one means the file is another paper: skip it.
    // The landing page is queued last and fetched only when everything else failed.
    const expectedDoi = normalizeDoi(result.metadata.doi ?? '');
    let triedLanding = false;
    for (;;) {
      const candidate = candidates.shift();
      if (candidate === undefined) {
        if (triedLanding) break;
        triedLanding = true;
        const harvested = await fetchLanding();
        mark('landing-fetch');
        if (harvested.length === 0) break;
        const fresh = [];
        const knownUrls = new Set([...result.tried.map((entry) => entry.url), ...candidates.map((entry) => entry.url)]);
        for (const entry of harvested) {
          if (!knownUrls.has(entry.url)) fresh.push(entry);
        }
        if (fresh.length === 0) break;
        candidates.push(...fresh);
        continue;
      }
      const attempt = { url: candidate.url, source: candidate.kind, ok: false, reason: '' };
      result.tried.push(attempt);
      const downloaded = await fetchPdf(candidate.url, CANDIDATE_TIMEOUT_MS);
      mark(`fetch:${candidate.kind}`);
      if (!downloaded.ok) {
        attempt.reason = downloaded.reason;
        continue;
      }
      if (expectedDoi !== null) {
        const read = doisFromPdfHead(downloaded.bytes.subarray(0, 200 * 1024));
        if (read.length > 0) {
          attempt.doiInFile = read[0];
          if (!read.some((value) => doiMatches(expectedDoi, value))) {
            attempt.reason = `the file belongs to another paper (DOI ${read[0]})`;
            continue;
          }
        }
      }
      // A publisher "abstract", cover sheet or correction is a valid PDF but not
      // the article: require at least three pages.
      const pages = pdfPageCount(downloaded.bytes, inflateSync);
      if (pages > 0 && pages < MIN_ARTICLE_PAGES) {
        attempt.reason = `only ${pages} page${pages === 1 ? '' : 's'} — this looks like an abstract, cover sheet or correction rather than the article`;
        continue;
      }
      const fileName = buildFileName(
        {
          year: result.metadata.year,
          venue: venueForSource(result.metadata, candidate.kind, candidate.url),
          title: result.metadata.title || text,
        },
        { suffix: versionSuffix(candidate.kind) },
      );      await fsp.mkdir(directory, { recursive: true });
      const target = await freePath(directory, fileName);
      await fsp.writeFile(target, downloaded.bytes);
      attempt.ok = true;
      attempt.pages = pages;
      result.status = 'downloaded';
      result.file = {
        path: target,
        name: path.basename(target),
        bytes: downloaded.bytes.length,
        source: candidate.kind,
        url: candidate.url,
        pages,
      };
      result.message = '已下载并保存到所选目录。';
      break;
    }

    if (result.status !== 'downloaded') {
      // An arXiv query may know a published DOI whose copy is not open.
      const published = result.metadata.published;
      if (!result.metadata.doi && published !== undefined && published.doi && published.doi !== '') {
        result.metadata.doi = published.doi;
        if (published.venue) result.metadata.venue = published.venue;
      }
      result.manual = await this.manualFallbacks(result, query);
      if (result.metadata.arxiv) {
        result.manual.unshift(manualHint(`https://arxiv.org/abs/${result.metadata.arxiv}`, 'arXiv abstract'));
      }
      const shortOnly = result.tried.length > 0 && result.tried.every((entry) => /only \d+ pages?/.test(entry.reason));
      result.message = candidates.length === 0
        ? '没有找到可自动下载的开放获取 PDF。'
        : shortOnly
          ? '只找到摘要/封面之类的短文件，不是论文全文，请按下方链接手动下载。'
          : '所有开放获取候选链接都不可用，请按下方链接手动下载。';
    }
    result.elapsedMs = Date.now() - started;
    this.ctx?.logger?.info?.(`paper-download: ${result.status} "${text.slice(0, 80)}" in ${result.elapsedMs} ms`);
    finish();
    return result;
  }

  /** Compose the manual-download list shown when automation fails. */
  async manualFallbacks(result, query) {
    const manual = [];
    if (result.metadata.doi) {
      const doi = result.metadata.doi;
      manual.push(manualHint(`https://doi.org/${doi}`, 'publisher page'));
      manual.push(manualHint(`https://www.semanticscholar.org/paper/${encodeURIComponent(doi)}`, 'Semantic Scholar'));
      manual.push(manualHint(`https://api.unpaywall.org/v2/${doiPath(doi)}?email=paper-download@dsh.local`, 'Unpaywall record'));
      manual.push(manualHint(`https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`, 'Google Scholar'));
    } else {
      manual.push(manualHint(`https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`, 'Google Scholar'));
      manual.push(manualHint(`https://www.semanticscholar.org/search?q=${encodeURIComponent(query)}`, 'Semantic Scholar'));
    }
    return manual;
  }

  /** List sub-directories of a folder for the built-in path browser. */
  async listFolders(target) {
    const start = path.resolve(target && String(target).trim() !== '' ? String(target) : desktopDirectory());
    let current = start;
    try {
      if (!(await fsp.stat(current)).isDirectory()) current = path.dirname(current);
    } catch {
      current = desktopDirectory();
    }
    const entries = [];
    const handle = await fsp.opendir(current).catch(() => null);
    if (handle !== null) {
      for await (const entry of handle) {
        if (!entry.isDirectory()) continue;
        if (entries.length >= 200) break;
        entries.push({ name: entry.name, path: path.join(current, entry.name) });
      }
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
    const parent = path.dirname(current);
    const segments = [];
    let cursor = current;
    for (;;) {
      const base = path.basename(cursor);
      segments.unshift({ name: base === '' ? cursor : base, path: cursor });
      const up = path.dirname(cursor);
      if (up === cursor) break;
      cursor = up;
    }
    return {
      path: current,
      parent: parent === current ? '' : parent,
      desktop: desktopDirectory(),
      home: os.homedir(),
      crumbs: segments,
      entries: entries.slice(0, 120),
    };
  }
}

/** Read a request body as JSON with a size cap. */
async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.byteLength;
    if (received > limit) throw failure('too-large', 'request body too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text === '' ? {} : JSON.parse(text);
}

/** Answer with JSON. */
function respond(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

/**
 * Mount the Host half.
 * @param ctx - profile-scope Cordis context.
 */
export function apply(ctx) {
  const resolver = new PaperResolver(ctx);

  // Wait for the browser transport instead of hard-injecting it, so a profile
  // without a web server still loads the plugin (it then serves nothing).
  // Both services are read inside this injected callback context: Cordis
  // refuses a service access from a context that did not inject it.
  ctx.inject(['webServer', 'connection'], (webCtx) => {
    const isForbidden = (req) => {
      const rejection = webCtx.connection.requestRejection(req);
      if (rejection === undefined) return undefined;
      return req.headers['x-dsh-paper-download'] === '1' ? undefined : rejection;
    };

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: async (req, res) => {
        try {
          const rejection = isForbidden(req);
          if (rejection !== undefined) {
            res.writeHead(rejection, { 'cache-control': 'no-store' });
            res.end(rejection === 401 ? 'unauthorized' : 'forbidden');
            return;
          }
          const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
          if (!pathname.startsWith(`${ROUTE_PREFIX}/`)) {
            respond(res, 404, { ok: false, error: { code: 'not-found', message: 'not found' } });
            return;
          }
          if (req.method !== 'POST') {
            respond(res, 405, { ok: false, error: { code: 'method-not-allowed', message: 'POST required' } });
            return;
          }
          const endpoint = pathname.slice(ROUTE_PREFIX.length + 1);
          const payload = await readJson(req);
          if (endpoint === 'resolve') {
            const value = await resolver.resolve(payload.query, { directory: payload.directory, email: payload.email });
            respond(res, 200, { ok: true, value });
            return;
          }
          if (endpoint === 'split') {
            // Recognise a pasted list without touching the network.
            const { entries, truncated } = splitReferences(payload.text, { limit: MAX_BATCH_ITEMS });
            respond(res, 200, { ok: true, value: { entries, truncated } });
            return;
          }
          if (endpoint === 'resolveMany') {
            // Download one entry at a time; progress is reported by the client
            // per item, so a single slow paper never hides the others.
            const items = Array.isArray(payload.items) ? payload.items.slice(0, MAX_BATCH_ITEMS) : [];
            const results = [];
            for (const item of items) {
              const query = typeof item === 'string' ? item : item?.query;
              if (typeof query !== 'string' || query.trim() === '') continue;
              try {
                results.push(await resolver.resolve(query, { directory: payload.directory, email: payload.email }));
              } catch (error) {
                results.push({
                  query,
                  directory: payload.directory ?? '',
                  status: 'failed',
                  file: null,
                  metadata: emptyMetadata(),
                  tried: [],
                  alternatives: [],
                  manual: [],
                  message: String(error?.message ?? error),
                  elapsedMs: 0,
                });
              }
            }
            respond(res, 200, { ok: true, value: { results } });
            return;
          }
          if (endpoint === 'folders') {
            const value = await resolver.listFolders(payload.path);
            respond(res, 200, { ok: true, value });
            return;
          }
          if (endpoint === 'openExternal') {
            // The panel lives inside the desktop app, so a link opened there
            // would only become another app tab; "手动搜索" means the user's
            // real browser. Only http(s) URLs are handed to the OS.
            const url = new URL(String(payload.url ?? ''));
            if (url.protocol !== 'https:' && url.protocol !== 'http:') throw failure('bad-url', 'only http(s) URLs can be opened');
            const { spawn } = await import('node:child_process');
            if (process.platform === 'win32') {
              spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url.href], { detached: true, stdio: 'ignore' }).unref();
            } else if (process.platform === 'darwin') {
              spawn('open', [url.href], { detached: true, stdio: 'ignore' }).unref();
            } else {
              spawn('xdg-open', [url.href], { detached: true, stdio: 'ignore' }).unref();
            }
            respond(res, 200, { ok: true, value: { url: url.href } });
            return;
          }
          if (endpoint === 'reveal') {
            const target = path.resolve(String(payload.path ?? ''));
            if (process.platform === 'win32') {
              const { spawn } = await import('node:child_process');
              spawn('explorer.exe', [`/select,${target}`], { detached: true, stdio: 'ignore' }).unref();
            }
            respond(res, 200, { ok: true, value: { path: target } });
            return;
          }
          respond(res, 404, { ok: false, error: { code: 'not-found', message: `unknown endpoint "${endpoint}"` } });
        } catch (error) {
          const code = typeof error?.code === 'string' ? error.code : 'internal';
          respond(res, 200, {
            ok: false,
            error: {
              code,
              message: error instanceof Error ? error.message : String(error),
              ...(error?.extra ?? {}),
            },
          });
        }
      },
    }), 'dsh-paper-fetcher: HTTP route');

    ctx.logger?.info?.(`dsh-paper-fetcher: HTTP route ${ROUTE_PREFIX}/* registered (default folder ${desktopDirectory()})`);
  });
}
