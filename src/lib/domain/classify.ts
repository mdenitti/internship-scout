import { slugify, looseKey } from '@/lib/util/text';
import type { ClassificationKind, ClassificationValue } from './types';

/**
 * Everything that decides "which category is this?" lives here and is driven by the
 * configurable registry. Business logic never mentions a concrete category such as
 * `devshop` or `Limburg`; it only asks this module to match against whatever values the
 * user has configured.
 */

export function valuesForKind(values: readonly ClassificationValue[], kind: ClassificationKind): ClassificationValue[] {
  return values
    .filter((value) => value.kind === kind)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));
}

export function findValueById(
  values: readonly ClassificationValue[],
  kind: ClassificationKind,
  id: string,
): ClassificationValue | null {
  const key = looseKey(id);
  return values.find((value) => value.kind === kind && looseKey(value.id) === key) ?? null;
}

export function labelFor(
  values: readonly ClassificationValue[],
  kind: ClassificationKind,
  idOrLabel: string | undefined | null,
): string | null {
  if (!idOrLabel) return null;
  const found = findValueById(values, kind, idOrLabel);
  return found ? found.label : idOrLabel;
}

export function isValidValue(
  values: readonly ClassificationValue[],
  kind: ClassificationKind,
  id: string | undefined | null,
): boolean {
  if (!id) return false;
  return findValueById(values, kind, id) !== null;
}

/** Build a stable, human readable id from a label, avoiding collisions inside a kind. */
export function buildValueId(
  values: readonly ClassificationValue[],
  kind: ClassificationKind,
  label: string,
): string {
  const base = slugify(label) || 'value';
  let candidate = base;
  let suffix = 2;
  const taken = new Set(values.filter((value) => value.kind === kind).map((value) => value.id));
  while (taken.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function termsFor(value: ClassificationValue): string[] {
  return [value.id, value.label, ...value.aliases].map(looseKey).filter((term) => term.length >= 2);
}

/**
 * Find the single best matching value for a piece of free text.
 * Matching order: exact id/label/alias, then longest partial match (word-ish contains).
 */
export function matchValue(
  values: readonly ClassificationValue[],
  kind: ClassificationKind,
  raw: string | undefined | null,
): ClassificationValue | null {
  if (!raw) return null;
  const haystack = looseKey(raw);
  if (!haystack) return null;

  let best: { value: ClassificationValue; length: number } | null = null;
  for (const value of valuesForKind(values, kind)) {
    for (const term of termsFor(value)) {
      const isExact = haystack === term;
      const isPartial = haystack.includes(term);
      if (!isExact && !isPartial) continue;
      const length = isExact ? Number.MAX_SAFE_INTEGER : term.length;
      if (!best || length > best.length) best = { value, length };
    }
  }
  return best?.value ?? null;
}

/** Find every matching value for a kind (used for technologies / skills). */
export function matchValues(
  values: readonly ClassificationValue[],
  kind: ClassificationKind,
  raw: string | undefined | null,
  limit = 20,
): ClassificationValue[] {
  if (!raw) return [];
  const haystack = looseKey(raw);
  if (!haystack) return [];

  const matches: Array<{ value: ClassificationValue; length: number }> = [];
  for (const value of valuesForKind(values, kind)) {
    for (const term of termsFor(value)) {
      if (!haystack.includes(term)) continue;
      matches.push({ value, length: term.length });
      break;
    }
  }
  return matches
    .sort((a, b) => b.length - a.length)
    .map((match) => match.value)
    .slice(0, limit);
}

/** The status a freshly imported internship gets. Configured, never hard-coded downstream. */
export function defaultStatusId(values: readonly ClassificationValue[]): string {
  const statuses = valuesForKind(values, 'status');
  if (statuses.length === 0) return 'new';
  const preferred = statuses.find((value) => ['new', 'discovered', 'inbox'].includes(looseKey(value.id)));
  return (preferred ?? statuses[0]!).id;
}

export function shortlistedStatusId(values: readonly ClassificationValue[]): string {
  const statuses = valuesForKind(values, 'status');
  const preferred = statuses.find((value) => /shortlist|favorite|favourite|starred/.test(looseKey(value.id)));
  return (preferred ?? statuses[0]!).id;
}

export function rejectedStatusId(values: readonly ClassificationValue[]): string {
  const statuses = valuesForKind(values, 'status');
  const preferred = statuses.find((value) => /reject|declin|archiv|pass/.test(looseKey(value.id)));
  return (preferred ?? statuses[statuses.length - 1]!).id;
}

/** Colour token for a value id, used by the UI badges. */
export function colorFor(
  values: readonly ClassificationValue[],
  kind: ClassificationKind,
  id: string | undefined | null,
): string {
  if (!id) return 'slate';
  return findValueById(values, kind, id)?.color ?? 'slate';
}
