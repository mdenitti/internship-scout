import { canonicalizeUrl, urlKey } from '@/lib/util/url';
import {
  cleanExternalText,
  collapseWhitespace,
  extractHashtags,
  looseKey,
  slugify,
  uniqBy,
} from '@/lib/util/text';
import { matchValue, matchValues, defaultStatusId } from './classify';
import type { ClassificationValue, DedupeKeys, Internship, InternshipCandidate } from './types';
import {
  LEGAL_ENTITY_SUFFIXES,
  TEXT_PATTERNS,
  TITLE_STOPWORDS,
  countryCodeFromName,
  findCountryCodeInText,
} from './reference';
import { toIsoDateOrUndefined } from './validate';

/**
 * Turns untrusted provider output into a normalized internship record.
 *
 * Pure functions only: no I/O, no clock reads unless injected. That keeps the whole
 * pipeline unit testable and makes it safe to run in a serverless function.
 */

export interface NormalizeContext {
  classifications: readonly ClassificationValue[];
  /** Status applied to newly imported records. Defaults to the configured "new"-like value. */
  statusId?: string;
  now?: () => Date;
  idFactory?: () => string;
}

export type NormalizeOutcome =
  | { ok: true; internship: Internship }
  | { ok: false; reason: string };

const WORK_MODE_HINTS: Record<string, string[]> = {
  remote: ['remote', 'telework', 'telewerk', 'thuiswerk', 'work from home', 'wfh', 'fully remote', 'anywhere'],
  hybrid: ['hybrid', 'hybride', 'partially remote', 'partly remote', 'days on site', '2 days office'],
  onsite: ['on-site', 'onsite', 'on site', 'office-based', 'kantoor', 'in office', 'in-house', 'on location'],
};

/** Strip the noise recruiters add to titles: "(m/f/d)", "| Company", "– Remote". */
export function normalizeTitle(raw: string): string {
  let title = cleanExternalText(raw, 300);
  title = title
    .replace(/\((?:m\s*\/\s*[fdx]|[fdx]\s*\/\s*m(?:\s*\/\s*[dx])?|h\s*\/\s*m)\)/gi, ' ')
    .replace(/\b(?:m|f|d|x)\s*\/\s*(?:m|f|d|x)(?:\s*\/\s*(?:m|f|d|x))?\b/gi, ' ')
    .replace(/\s*[|·•]\s*(?:remote|hybrid|onsite|on-site|full[- ]time|part[- ]time)\s*/gi, ' ')
    .replace(/\s*[-–—]\s*(?:remote|hybrid|onsite|on-site)\s*$/i, ' ')
    // A leftover empty "( )" after removing "(m/f/d)" style markers.
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,:;\-–—|]+|[\s,:;\-–—|]+$/g, '');
  return title.trim();
}

/** Normalize a company name and strip legal entity suffixes for comparison. */
export function normalizeCompany(raw: string): string {
  const cleaned = cleanExternalText(raw, 200).replace(/\s{2,}/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  while (parts.length > 1) {
    const last = looseKey(parts[parts.length - 1] as string);
    const beforeLast = parts.length > 2 ? looseKey(parts[parts.length - 2] as string) : '';
    if (LEGAL_ENTITY_SUFFIXES.includes(last) || (last === 'group' && beforeLast === 'emil')) {
      parts.pop();
      continue;
    }
    if (LEGAL_ENTITY_SUFFIXES.includes(beforeLast) && ['group', 'holding', 'international'].includes(last)) {
      parts.pop();
      continue;
    }
    break;
  }
  const result = parts.join(' ').replace(/[,\s]+$/, '').trim();
  return result.length >= 2 ? result : cleaned;
}

/** company|title|location fingerprint ignoring case, punctuation and seniority noise. */
export function fingerprintOf(company: string, title: string, location?: string): string {
  const titleTokens = title
    .split(/\s+/)
    .map(looseKey)
    .filter((token) => token.length > 0 && !TITLE_STOPWORDS.includes(token));
  const titleFingerprint = slugify(titleTokens.join(' ') || title) || 'untitled';
  const companyFingerprint = slugify(normalizeCompany(company)) || 'unknown-company';
  const locationFingerprint = slugify((location ?? '').split(',')[0] ?? '') || 'unknown-location';
  return `${companyFingerprint}|${titleFingerprint}|${locationFingerprint}`;
}

export function buildDedupeKeys(input: {
  url: string;
  company: string;
  title: string;
  location?: string;
}): DedupeKeys {
  return {
    canonicalUrl: canonicalizeUrl(input.url),
    urlKey: urlKey(input.url),
    fingerprint: fingerprintOf(input.company, input.title, input.location),
  };
}

function inferWorkMode(raw: string, classifications: readonly ClassificationValue[]): string | undefined {
  const direct = matchValue(classifications, 'workMode', raw);
  if (direct) return direct.id;

  const haystack = raw.toLowerCase();
  for (const concept of Object.keys(WORK_MODE_HINTS)) {
    const hints = WORK_MODE_HINTS[concept] ?? [];
    if (!hints.some((hint) => haystack.includes(hint))) continue;
    const mapped = matchValue(classifications, 'workMode', concept);
    if (mapped) return mapped.id;
  }
  return undefined;
}

/** Best-effort date from an explicit field, otherwise from an already matched pattern. */
function pickDate(explicit: string | undefined, ...fallbacks: Array<string | undefined>): string | undefined {
  const fromExplicit = toIsoDateOrUndefined(explicit);
  if (fromExplicit) return fromExplicit;
  for (const candidate of fallbacks) {
    const date = toIsoDateOrUndefined(candidate);
    if (date) return date;
  }
  return undefined;
}

/**
 * Normalize one raw candidate. Returns `ok: false` with a human readable reason when the
 * candidate cannot be stored (unsafe URL, empty title/company, ...). The caller reports
 * those to the user instead of dropping them silently.
 */
export function normalizeCandidate(
  candidate: InternshipCandidate,
  context: NormalizeContext,
): NormalizeOutcome {
  const now = context.now ?? (() => new Date());
  const idFactory = context.idFactory ?? defaultIdFactory;

  const title = normalizeTitle(candidate.title ?? '');
  if (title.length < 2) return { ok: false, reason: 'Missing or unreadable job title' };

  const company = normalizeCompany(candidate.company ?? '');
  if (company.length < 2) return { ok: false, reason: 'Missing company name' };

  const canonicalUrl = canonicalizeUrl(candidate.url);
  if (!canonicalUrl) return { ok: false, reason: 'Unusable or unsafe application URL' };

  const classifications = context.classifications;
  const location = collapseWhitespace(cleanExternalText(candidate.location ?? '', 200));
  const description = cleanExternalText(candidate.description ?? candidate.rawText ?? '', 20000).trim();
  const rawText = candidate.rawText ? cleanExternalText(candidate.rawText, 20000) : undefined;
  const haystack = `${title}\n${location}\n${description}`;

  const explicitRegion = candidate.region ? matchValue(classifications, 'region', candidate.region) : null;
  const region =
    explicitRegion?.id ?? matchValue(classifications, 'region', location)?.id ?? undefined;

  const explicitCountry = candidate.country ? countryCodeFromName(candidate.country) : null;
  const country = explicitCountry ?? findCountryCodeInText(location) ?? undefined;

  const workMode = candidate.workMode
    ? (matchValue(classifications, 'workMode', candidate.workMode)?.id ?? undefined)
    : inferWorkMode(haystack, classifications);

  const internshipType = candidate.internshipType
    ? (matchValue(classifications, 'internshipType', candidate.internshipType)?.id ?? undefined)
    : matchValue(classifications, 'internshipType', `${title} ${haystack}`)?.id;

  const companyType = candidate.companyType
    ? (matchValue(classifications, 'companyType', candidate.companyType)?.id ?? undefined)
    : undefined;

  const technologyIds = uniqBy(
    [
      ...matchValues(classifications, 'technology', `${title} ${haystack}`, 20).map((value) => value.label),
      ...(candidate.technologies ?? []),
      ...extractHashtags(`${title} ${description}`),
    ].filter((value) => value.length >= 1),
    (value) => looseKey(value),
  ).slice(0, 24);

  const skills = uniqBy(
    [...(candidate.skills ?? []), ...matchValues(classifications, 'technology', description, 10).map((v) => v.label)],
    (value) => looseKey(value),
  ).slice(0, 24);

  const duration = candidate.duration?.trim() || TEXT_PATTERNS.duration.exec(haystack)?.[0] || undefined;
  const compensation = candidate.compensation?.trim() || TEXT_PATTERNS.compensation.exec(haystack)?.[0] || undefined;

  const deadlineText = TEXT_PATTERNS.deadline.exec(haystack)?.[0];
  const startDateText = TEXT_PATTERNS.startDate.exec(haystack)?.[1];

  const timestamp = now().toISOString();
  const internship: Internship = {
    id: idFactory(),
    title,
    company,
    description,
    url: canonicalUrl,
    source: candidate.source.slice(0, 60),
    sourceId: candidate.sourceId?.slice(0, 200),
    location,
    country,
    region,
    internshipType,
    companyType,
    technologies: technologyIds,
    skills,
    workMode,
    duration: duration?.slice(0, 80),
    startDate: pickDate(candidate.startDate, startDateText),
    deadline: pickDate(candidate.deadline, deadlineText),
    compensation: compensation?.slice(0, 120),
    discoveredAt: timestamp,
    updatedAt: timestamp,
    status: context.statusId ?? defaultStatusId(classifications),
    evaluation: null,
    evaluationStatus: 'unevaluated',
    evaluationError: null,
    manualOverride: null,
    dedupe: buildDedupeKeys({ url: canonicalUrl, company, title, location }),
    extra: candidate.extra,
  };
  if (rawText) internship.rawText = rawText;
  if (candidate.publishedAt) {
    internship.extra = { ...(internship.extra ?? {}), publishedAt: candidate.publishedAt };
  }
  return { ok: true, internship };
}

function defaultIdFactory(): string {
  const cryptoRef = globalThis.crypto as Crypto | undefined;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Re-run classification on an existing record. Used after the classification registry
 * changes, after an edit, or when the user asks to re-derive structured fields.
 * Only fields that can be re-derived safely are touched.
 */
export function reclassifyInternship(
  internship: Internship,
  classifications: readonly ClassificationValue[],
): Internship {
  const haystack = `${internship.title}\n${internship.location}\n${internship.description}`;

  const existingWorkMode = internship.workMode
    ? matchValue(classifications, 'workMode', internship.workMode)
    : null;
  const workMode = existingWorkMode?.id ?? inferWorkMode(haystack, classifications);

  const existingRegion = internship.region ? matchValue(classifications, 'region', internship.region) : null;
  const region = existingRegion?.id ?? matchValue(classifications, 'region', internship.location)?.id;

  const internshipType = matchValue(classifications, 'internshipType', internship.title)?.id;

  const country = internship.country
    ? (countryCodeFromName(internship.country) ?? internship.country)
    : (findCountryCodeInText(internship.location) ?? undefined);

  return {
    ...internship,
    region,
    country,
    workMode,
    internshipType: internshipType ?? internship.internshipType,
  };
}

