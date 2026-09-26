import { findValueById, matchValue } from './classify';
import type { ClassificationKind, ClassificationValue, Internship } from './types';

/**
 * Keeps stored internships consistent with the configurable classification registry.
 *
 * Internship fields store the classification *value id* (e.g. `devshop`), never a display
 * label, so renaming a value in the settings UI does not touch a single record. When a value
 * is deleted, the references are pruned (or re-pointed) here.
 */

const FIELD_BY_KIND: Partial<Record<ClassificationKind, keyof Internship>> = {
  companyType: 'companyType',
  region: 'region',
  workMode: 'workMode',
  internshipType: 'internshipType',
  status: 'status',
};

export function referenceCounts(
  values: readonly ClassificationValue[],
  internships: readonly Internship[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value.id] = 0;

  for (const internship of internships) {
    for (const [kind, field] of Object.entries(FIELD_BY_KIND) as Array<[ClassificationKind, keyof Internship]>) {
      const current = internship[field];
      if (typeof current !== 'string' || current.length === 0) continue;
      const match = findValueById(values, kind, current);
      if (match) counts[match.id] = (counts[match.id] ?? 0) + 1;
    }
    for (const technology of internship.technologies) {
      const match = matchValue(values, 'technology', technology);
      if (match) counts[match.id] = (counts[match.id] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Drop references to values that no longer exist. Returns the same object when nothing
 * changed so callers can skip unnecessary writes.
 */
export function pruneReferences(
  internship: Internship,
  values: readonly ClassificationValue[],
): { internship: Internship; changed: boolean } {
  let changed = false;
  const next: Internship = { ...internship };

  for (const [kind, field] of Object.entries(FIELD_BY_KIND) as Array<[ClassificationKind, keyof Internship]>) {
    const current = internship[field];
    if (typeof current !== 'string' || current.length === 0) continue;
    if (findValueById(values, kind, current)) continue;
    if (kind === 'status') continue; // a status always stays readable, even if unconfigured
    delete (next as unknown as Record<string, unknown>)[field as string];
    changed = true;
  }

  return { internship: next, changed };
}

/** Which values are available for a specific internship field, for the edit UI. */
export function optionsForKind(
  values: readonly ClassificationValue[],
  kind: ClassificationKind,
): Array<{ id: string; label: string; color: string }> {
  return values
    .filter((value) => value.kind === kind)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label))
    .map((value) => ({ id: value.id, label: value.label, color: value.color ?? 'slate' }));
}
