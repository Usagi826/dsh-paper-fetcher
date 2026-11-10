/**
 * Journal-name abbreviation in the NLM/CASSI style.
 *
 * The published abbreviation comes from metadata when an API offers one
 * (Crossref `short-container-title`, NLM catalog). When it does not, this module
 * rebuilds it word by word from the NLM abbreviation list, so a name like
 * "Nature Neuroscience" becomes "Nat. Neurosci." instead of staying unabbreviated.
 */

/** NLM/PubMed journal-word abbreviations; values omit the trailing period. */
export const NLM_WORDS = {
  abstracts: 'Abstr', academy: 'Acad', accounts: 'Acc', acta: 'Acta', advanced: 'Adv', advances: 'Adv',
  agricultural: 'Agric', agriculture: 'Agric', american: 'Am', analytical: 'Anal', anatomical: 'Anat',
  anesthesia: 'Anesth', animal: 'Anim', annals: 'Ann', annual: 'Annu', anthropological: 'Anthropol',
  antimicrobial: 'Antimicrob', applied: 'Appl', archives: 'Arch', association: 'Assoc',
  atmospheric: 'Atmos', basic: 'Basic', behavior: 'Behav', behavioral: 'Behav', behavioural: 'Behav',
  biochemical: 'Biochem', biochemistry: 'Biochem', bioinformatics: 'Bioinform', biological: 'Biol',
  biology: 'Biol', biomedical: 'Biomed', biophysical: 'Biophys', biophysics: 'Biophys',
  bioscience: 'Biosci', biosciences: 'Biosci', biotechnology: 'Biotechnol', botany: 'Bot',
  british: 'Br', bulletin: 'Bull', cardiology: 'Cardiol', cellular: 'Cell', chemical: 'Chem',
  chemistry: 'Chem', clinical: 'Clin', cognition: 'Cogn', cognitive: 'Cogn', college: 'Coll',
  communications: 'Commun', comparative: 'Comp', computational: 'Comput', computer: 'Comput',
  conference: 'Conf', contemporary: 'Contemp', contributions: 'Contrib', critical: 'Crit',
  current: 'Curr', development: 'Dev', developmental: 'Dev', digestive: 'Dig', disease: 'Dis',
  diseases: 'Dis', disorders: 'Disord', drug: 'Drug', dynamics: 'Dyn', ecology: 'Ecol',
  economics: 'Econ', education: 'Educ', emergency: 'Emerg', endocrine: 'Endocr',
  endocrinology: 'Endocrinol', energy: 'Energy', engineering: 'Eng', environmental: 'Environ',
  epidemiology: 'Epidemiol', european: 'Eur', evolution: 'Evol', experimental: 'Exp',
  federation: 'Fed', frontier: 'Front', frontiers: 'Front', fundamental: 'Fundam',
  gastroenterology: 'Gastroenterol', general: 'Gen', genetics: 'Genet', genomics: 'Genomics',
  geographical: 'Geogr', geology: 'Geol', hematology: 'Hematol', histochemistry: 'Histochem',
  histology: 'Histol', human: 'Hum', immunology: 'Immunol', industrial: 'Ind', informatics: 'Inform',
  information: 'Inf', inorganic: 'Inorg', institute: 'Inst', integrated: 'Integr',
  integrative: 'Integr', international: 'Int', investigation: 'Invest', journal: 'J',
  journalof: 'J', laboratory: 'Lab', letters: 'Lett', life: 'Life', london: 'Lond',
  macromolecular: 'Macromol', magnetic: 'Magn', management: 'Manag', marine: 'Mar', materials: 'Mater',
  mathematics: 'Math', mechanical: 'Mech', medical: 'Med', medicinal: 'Med', medicine: 'Med',
  membrane: 'Membr', methods: 'Methods', microbial: 'Microb', microbiology: 'Microbiol',
  microscopy: 'Microsc', molecular: 'Mol', national: 'Natl', nature: 'Nat', neural: 'Neural',
  neurology: 'Neurol', neuroscience: 'Neurosci', neurosciences: 'Neurosci',
  neurophysiology: 'Neurophysiol', nuclear: 'Nucl', nutrition: 'Nutr', obstetrics: 'Obstet',
  occupational: 'Occup', oceanography: 'Oceanogr', oncology: 'Oncol', ophthalmology: 'Ophthalmol',
  optics: 'Opt', organic: 'Org', orthopedic: 'Orthop', parasitology: 'Parasitol',
  pathology: 'Pathol', pediatric: 'Pediatr', pediatrics: 'Pediatr', pharmaceutical: 'Pharm',
  pharmacology: 'Pharmacol', pharmacy: 'Pharm', philosophical: 'Philos', philosophy: 'Philos',
  physical: 'Phys', physics: 'Phys', physiological: 'Physiol', physiology: 'Physiol',
  planetary: 'Planet', plant: 'Plant', policy: 'Policy', political: 'Polit', postgraduate: 'Postgrad',
  practice: 'Pract', preventive: 'Prev', proceedings: 'Proc', professional: 'Prof', progress: 'Prog',
  psychiatry: 'Psychiatry', psychological: 'Psychol', psychology: 'Psychol', public: 'Public',
  quarterly: 'Q', radiation: 'Radiat', radiology: 'Radiol', research: 'Res', review: 'Rev',
  reviews: 'Rev', robot: 'Robot', robotics: 'Robot', royal: 'R', science: 'Sci', sciences: 'Sci',
  scientific: 'Sci', semiconductor: 'Semicond', signal: 'Signal', society: 'Soc', sociology: 'Sociol',
  statistical: 'Stat', statistics: 'Stat', structural: 'Struct', structure: 'Struct', surgery: 'Surg',
  surgical: 'Surg', survey: 'Surv', sustainable: 'Sustain', system: 'Syst', systems: 'Syst',
  technical: 'Tech', technology: 'Technol', theoretical: 'Theor', therapeutics: 'Ther',
  therapy: 'Ther', transactions: 'Trans', tropical: 'Trop', ultrasonography: 'Ultrasonogr',
  university: 'Univ', urban: 'Urban', urology: 'Urol', vaccinology: 'Vaccinol', veterinary: 'Vet',
  virology: 'Virol', vision: 'Vis', world: 'World', zoology: 'Zool',
};

/** Function words never appear in an NLM abbreviation ("J. Neurosci."). */
export const DROP_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'on', 'at', 'to', 'with', 'from', 'a', 'an', 'by', 'de', 'der', 'la', 'le', 'und']);

/** Tokens already written as acronyms ("PLOS", "JAMA") keep their form, no period. */
const ACRONYM = /^[A-Z]{2,}$/;

/** Chinese characters: such a title is never abbreviated. */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/**
 * Abbreviate one journal title the NLM/CASSI way.
 * A title of a single word is returned unchanged, matching CASSI, which lists
 * "Nature" for Nature and "Cell" for Cell.
 * @param title - full journal name, e.g. "Nature Neuroscience".
 * @returns the abbreviation, e.g. "Nat. Neurosci."; '' for blank input.
 */
export function abbreviateJournal(title) {
  const cleaned = String(title ?? '')
    .replace(/\s*\([^)]*\)\s*$/g, ' ')
    .replace(/[.:;,]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned === '') return '';
  // Chinese journals have no NLM/CASSI abbreviation: the word-level rules below
  // would glue a period onto each character. Their full name is the right label.
  if (CJK.test(cleaned)) return cleaned;
  const words = cleaned.split(' ');
  if (words.length === 1) return words[0];

  const parts = [];
  for (const word of words) {
    const key = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (DROP_WORDS.has(key)) continue;
    const mapped = NLM_WORDS[key];
    if (mapped !== undefined) parts.push(ACRONYM.test(mapped) ? mapped : `${mapped}.`);
    else if (ACRONYM.test(word)) parts.push(word);
    else parts.push(`${word.replace(/[.:;,]+$/, '')}.`);
  }
  return parts.join(' ');
}

/**
 * Normalize an abbreviation that came from an API. Crossref mixes styles
 * ("Nat Neurosci", "Nat Neurosci.", "Proc. Natl. Acad. Sci. U.S.A."); the file
 * name keeps one style: a period after every shortened word, none after an
 * all-caps acronym, single spaces.
 * @param value - the raw abbreviation.
 * @param fullTitle - the full journal name, used for one-word journals.
 */
export function normalizeAbbreviation(value, fullTitle = '') {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim().replace(/[;,]+$/, '');
  if (raw === '') return '';
  const full = String(fullTitle ?? '').replace(/\s+/g, ' ').trim();
  // Chinese titles are shown in full: an API "abbreviation" for them is either
  // the same string or a meaningless pinyin snippet.
  if (CJK.test(full)) return full;
  if (CJK.test(raw)) return raw;
  // A one-word journal keeps its plain name ("Nature"), with or without a dot.
  if (!raw.includes(' ') && full.split(' ').length <= 1) return raw.replace(/\.+$/, '');
  const words = raw.split(' ');
  return words
    .map((word) => {
      // An already-dotted token keeps its own form: "U.S.A.", "Jr.".
      if (word.includes('.')) return word;
      if (ACRONYM.test(word)) return word;
      return `${word}.`;
    })
    .join(' ');
}

/**
 * Decide the journal label for a file name: prefer the abbreviation, fall back
 * to the full title, and never return a bare publisher name.
 * @param fullTitle - journal name from metadata.
 * @param abbreviation - abbreviation from metadata or the local cache.
 * @param options.useShort - whether the user wants abbreviations (default true).
 */
export function journalLabel(fullTitle, abbreviation, options = {}) {
  const useShort = options.useShort !== false;
  const full = String(fullTitle ?? '').trim();
  const short = normalizeAbbreviation(abbreviation, full);
  if (useShort && short !== '') return short;
  if (full !== '') return full;
  return abbreviateJournal(full);
}
