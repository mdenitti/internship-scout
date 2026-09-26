/**
 * Reference data (NOT business rules).
 *
 * These tables only help turn free text found in job ads into structured data. They contain
 * no policy: which regions/technologies/company types matter stays in the user editable
 * classification registry, and which locations are *preferred* stays in the evaluation profile.
 */

const COUNTRY_ALIASES: Record<string, string> = {
  belgium: 'BE',
  belgie: 'BE',
  belgië: 'BE',
  belgique: 'BE',
  be: 'BE',
  netherlands: 'NL',
  nederland: 'NL',
  holland: 'NL',
  nl: 'NL',
  germany: 'DE',
  deutschland: 'DE',
  de: 'DE',
  france: 'FR',
  frankrijk: 'FR',
  fr: 'FR',
  luxembourg: 'LU',
  lu: 'LU',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  gb: 'GB',
  ireland: 'IE',
  ie: 'IE',
  spain: 'ES',
  espana: 'ES',
  'españa': 'ES',
  es: 'ES',
  portugal: 'PT',
  pt: 'PT',
  italy: 'IT',
  it: 'IT',
  poland: 'PL',
  pl: 'PL',
  sweden: 'SE',
  se: 'SE',
  denmark: 'DK',
  dk: 'DK',
  norway: 'NO',
  no: 'NO',
  finland: 'FI',
  fi: 'FI',
  austria: 'AT',
  at: 'AT',
  switzerland: 'CH',
  ch: 'CH',
  'united states': 'US',
  usa: 'US',
  'u.s.a.': 'US',
  'united states of america': 'US',
  us: 'US',
  canada: 'CA',
  ca: 'CA',
  australia: 'AU',
  au: 'AU',
  india: 'IN',
  in: 'IN',
  worldwide: 'WW',
  global: 'WW',
  remote: 'WW',
};

/** Legal entity suffixes stripped when comparing company names. */
export const LEGAL_ENTITY_SUFFIXES = [
  'bv',
  'b.v.',
  'bvba',
  'nv',
  'n.v.',
  'vzw',
  'cv',
  'gmbh',
  'ag',
  'ug',
  'inc',
  'inc.',
  'llc',
  'l.l.c.',
  'ltd',
  'ltd.',
  'limited',
  'corp',
  'corporation',
  'co',
  'co.',
  'plc',
  'sa',
  's.a.',
  'sarl',
  's.r.l.',
  'srl',
  'ab',
  'as',
  'asa',
  'oy',
  'aps',
  'spa',
  's.p.a.',
  'pte',
  'pty',
  'kg',
  'ohg',
];

/** Words that are noise in a title when building a fingerprint. */
export const TITLE_STOPWORDS = ['intern', 'internship', 'stage', 'stagair', 'student', 'job', 'vacancy', 'm/f/x'];

export function countryCodeFromName(value: string | undefined | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (key.length === 0) return null;
  return COUNTRY_ALIASES[key] ?? null;
}

/** Look for a country mention in `haystack` (e.g. "Leuven, Belgium"). */
export function findCountryCodeInText(haystack: string): string | null {
  const lower = haystack.toLowerCase();
  const candidates = Object.keys(COUNTRY_ALIASES).filter((alias) => alias.length > 1);
  let best: { code: string; length: number } | null = null;
  for (const alias of candidates) {
    const pattern = new RegExp(`(^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    if (!pattern.test(lower)) continue;
    const code = COUNTRY_ALIASES[alias] as string;
    if (!best || alias.length > best.length) best = { code, length: alias.length };
  }
  return best?.code ?? null;
}

const COUNTRY_LABELS: Record<string, string> = {
  BE: 'Belgium',
  NL: 'Netherlands',
  DE: 'Germany',
  FR: 'France',
  LU: 'Luxembourg',
  GB: 'United Kingdom',
  IE: 'Ireland',
  ES: 'Spain',
  PT: 'Portugal',
  IT: 'Italy',
  PL: 'Poland',
  SE: 'Sweden',
  DK: 'Denmark',
  NO: 'Norway',
  FI: 'Finland',
  AT: 'Austria',
  CH: 'Switzerland',
  US: 'United States',
  CA: 'Canada',
  AU: 'Australia',
  IN: 'India',
  WW: 'Worldwide',
};

export function countryLabel(code: string | undefined | null): string | null {
  if (!code) return null;
  return COUNTRY_LABELS[code.toUpperCase()] ?? code.toUpperCase();
}

/** Regexes used to pull structured bits out of free text (best effort, never authoritative). */
export const TEXT_PATTERNS = {
  duration: /\b(\d{1,2}\s*(?:-|–|to)?\s*\d{0,2}\s*(?:months?|maanden?|weken?|weeks?|jaar|year))\b/i,
  compensation:
    /((?:€|EUR|USD|\$|£)\s?\d[\d.,]*(?:\s?(?:k|per month|\/month|\/maand|per uur|\/hour|per year|\/year|bruto|netto))?)/i,
  deadline:
    /\b(?:deadline|apply before|applications? close[sd]?|solliciteer(?:en)? (?:voor|ten laatste)|uiterlijk)\b[^.\n]{0,40}/i,
  startDate: /\b(?:start(?:ing)?|from|vanaf)\b[^.\n]{0,30}\b(\d{1,2}[-/ ]\d{1,2}[-/ ]\d{2,4}|[A-Z][a-z]+ \d{4})\b/i,
};
