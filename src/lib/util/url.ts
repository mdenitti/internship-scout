/**
 * URL handling. Every URL that comes from the outside world (search provider, AI output,
 * user input) goes through here before it is stored or rendered.
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref',
  'referrer',
  'source',
  'src',
  'trk',
  'trackingid',
  'gh_src',
  'lever-origin',
  'lever-source',
  'jobboard',
  'from',
  'spm',
]);

/**
 * Parse only what we are willing to store/link: absolute http(s) URLs with a hostname
 * and no embedded credentials. `javascript:`, `data:`, `file:` and malformed input are
 * rejected, which prevents stored-XSS through crafted provider content.
 */
export function parseSafeUrl(input: string | undefined | null): URL | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) {
    // whitespace/control chars inside a URL are never legitimate here
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;
  if (url.username || url.password) return null;
  return url;
}

export function isSafeExternalUrl(input: string | undefined | null): boolean {
  return parseSafeUrl(input) !== null;
}

/**
 * Canonical form used for duplicate detection:
 *  - lowercase host, strip `www.`
 *  - drop the fragment and tracking query params, sort the rest
 *  - drop a trailing slash on the path
 */
export function canonicalizeUrl(input: string | undefined | null): string | null {
  const url = parseSafeUrl(input);
  if (!url) return null;

  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.hash = '';

  const kept: Array<[string, string]> = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) continue;
    kept.push([key, value]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = '';
  for (const [key, value] of kept) url.searchParams.append(key, value);

  let pathname = url.pathname.replace(/\/+$/, '');
  if (pathname === '') pathname = '/';
  url.pathname = pathname;
  url.port = '';

  const search = url.searchParams.toString();
  return `${url.protocol}//${url.hostname}${pathname}${search ? `?${search}` : ''}`;
}

/** Host + path, ignoring the query entirely: a looser duplicate signal than the canonical URL. */
export function urlKey(input: string | undefined | null): string | null {
  const url = parseSafeUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return `${host}${path}`;
}

export function hostnameOf(input: string | undefined | null): string | null {
  const url = parseSafeUrl(input);
  if (!url) return null;
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

/** Absolute, root-relative or mailto links are not allowed as external references. */
export function safeExternalHref(input: string | undefined | null): string | null {
  const url = parseSafeUrl(input);
  return url ? url.toString() : null;
}
