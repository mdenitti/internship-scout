/**
 * Pure text helpers used by the normalizer. All functions are side-effect free so
 * they can be unit tested directly.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  szlig: 'ß',
};

/** Decode the handful of HTML entities that show up in job feeds. */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * Convert untrusted HTML-ish source text into plain text. We never render external
 * HTML in the UI, so stripping here is both a normalization and a security step.
 */
export function stripHtml(input: string | undefined | null): string {
  if (!input) return '';
  return decodeEntities(
    input
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<[^>]+>/g, ' '),
  );
}

/** Remove control characters that can break prompts or logs. */
export function stripControlCharacters(input: string): string {
  return input.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
}

/** Collapse whitespace, keep at most one blank line between paragraphs. */
export function collapseWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Full cleanup pipeline for external text: strip markup, control chars, squeeze space. */
export function cleanExternalText(input: string | undefined | null, maxLength = 8000): string {
  const cleaned = collapseWhitespace(stripControlCharacters(stripHtml(input)));
  return truncate(cleaned, maxLength);
}

export function truncate(input: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  if (input.length <= maxLength) return input;
  return `${input.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Slug used for fingerprints, ids and matching. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Loose key used when comparing labels ("Node.js" ≈ "NodeJS"). */
export function looseKey(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function uniqBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const value of values) {
    const k = key(value);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(value);
  }
  return out;
}

/** Parse a comma / semicolon / newline separated list into trimmed unique values. */
export function parseList(input: string | string[] | undefined | null): string[] {
  if (!input) return [];
  const parts = Array.isArray(input) ? input : input.split(/[,;\n|]+/);
  return uniq(parts.map((part) => part.trim()).filter(Boolean));
}

/** Extract `#tag` style technology markers frequently used in job posts. */
export function extractHashtags(input: string): string[] {
  const matches = input.match(/#[a-z0-9][a-z0-9+.\-_]{1,24}/gi) ?? [];
  return uniq(matches.map((match) => match.slice(1).trim()).filter(Boolean));
}

/** Case-insensitive "does haystack contain needle" for short needles only. */
export function containsToken(haystack: string, needle: string): boolean {
  const h = looseKey(haystack);
  const n = looseKey(needle);
  if (!n) return false;
  return h.includes(n);
}

export function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}
