import { looseKey } from '@/lib/util/text';
import { effectiveScore, isEvaluated } from './score';
import type { Internship, InternshipFilter, InternshipSort } from './types';

/**
 * Filtering and sorting work on plain arrays in memory. The data volumes involved
 * (hundreds to a few thousand internships) keep this simple and dependency free, and it
 * means the JSON store and Postgres store behave identically.
 */

export function searchHaystack(internship: Internship): string {
  return [
    internship.title,
    internship.company,
    internship.location,
    internship.region ?? '',
    internship.country ?? '',
    internship.description,
    internship.notes ?? '',
    internship.source,
    internship.workMode ?? '',
    internship.internshipType ?? '',
    internship.companyType ?? '',
    internship.technologies.join(' '),
    internship.skills.join(' '),
    internship.compensation ?? '',
    internship.evaluation?.summary ?? '',
    ...(internship.evaluation?.reasons ?? []),
  ]
    .join('\n')
    .toLowerCase();
}

function withinDateRange(value: string | undefined, after?: string, before?: string): boolean {
  if (!after && !before) return true;
  if (!value) return false;
  const timestamp = Date.parse(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(timestamp)) return false;
  if (after) {
    const afterTs = Date.parse(after.length <= 10 ? `${after}T00:00:00Z` : after);
    if (!Number.isNaN(afterTs) && timestamp < afterTs) return false;
  }
  if (before) {
    const beforeTs = Date.parse(before.length <= 10 ? `${before}T23:59:59Z` : before);
    if (!Number.isNaN(beforeTs) && timestamp > beforeTs) return false;
  }
  return true;
}

function matchesAny(selected: readonly string[] | undefined, value: string | undefined): boolean {
  if (!selected || selected.length === 0) return true;
  if (!value) return false;
  const key = looseKey(value);
  return selected.some((entry) => looseKey(entry) === key);
}

function matchesListContains(selected: readonly string[] | undefined, values: readonly string[]): boolean {
  if (!selected || selected.length === 0) return true;
  const haystack = values.map(looseKey);
  return selected.some((entry) => haystack.includes(looseKey(entry)));
}

export function matchesFilter(internship: Internship, filter: InternshipFilter): boolean {
  if (filter.demoOnly && !internship.isDemo) return false;
  if (filter.includeDemo === false && internship.isDemo) return false;

  if (filter.text && filter.text.trim().length > 0) {
    const terms = filter.text
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);
    const haystack = searchHaystack(internship);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }

  if (!matchesAny(filter.status, internship.status)) return false;
  if (filter.shortlistedOnly && !/shortlist|favorite|favourite|starred/i.test(internship.status)) return false;
  if (!matchesListContains(filter.companyType, internship.companyType ? [internship.companyType] : [])) return false;
  if (!matchesListContains(filter.region, internship.region ? [internship.region] : [])) return false;
  if (!matchesListContains(filter.workMode, internship.workMode ? [internship.workMode] : [])) return false;
  if (!matchesListContains(filter.internshipType, internship.internshipType ? [internship.internshipType] : [])) {
    return false;
  }
  if (!matchesListContains(filter.technologies, internship.technologies)) return false;
  if (!matchesListContains(filter.sources, [internship.source])) return false;

  if (filter.location && !looseKey(internship.location).includes(looseKey(filter.location))) return false;
  if (filter.company && !looseKey(internship.company).includes(looseKey(filter.company))) return false;

  if (filter.evaluationStatus && filter.evaluationStatus.length > 0) {
    if (!filter.evaluationStatus.includes(internship.evaluationStatus)) return false;
  }
  if (filter.hasEvaluation === true && !isEvaluated(internship)) return false;
  if (filter.hasEvaluation === false && isEvaluated(internship)) return false;

  const score = effectiveScore(internship);
  if (typeof filter.scoreMin === 'number' && (score === null || score < filter.scoreMin)) return false;
  if (typeof filter.scoreMax === 'number' && (score === null || score > filter.scoreMax)) return false;

  if (filter.discoveredAfter && !withinDateRange(internship.discoveredAt, filter.discoveredAfter)) return false;
  if (filter.deadlineBefore && !withinDateRange(internship.deadline, undefined, filter.deadlineBefore)) {
    return false;
  }

  return true;
}

export function filterInternships(
  internships: readonly Internship[],
  filter: InternshipFilter = {},
): Internship[] {
  return internships.filter((internship) => matchesFilter(internship, filter));
}

function compareValues(a: string | null, b: string | null, direction: 1 | -1): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b) * direction;
}

export function sortInternships(
  internships: readonly Internship[],
  sort: InternshipSort = { field: 'score', direction: 'desc' },
): Internship[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...internships].sort((left, right) => {
    switch (sort.field) {
      case 'score': {
        const a = effectiveScore(left);
        const b = effectiveScore(right);
        if (a === b) return compareValues(left.company, right.company, 1);
        if (a === null) return 1;
        if (b === null) return -1;
        return (a - b) * direction;
      }
      case 'company':
        return compareValues(left.company, right.company, direction);
      case 'location':
        return compareValues(left.location || null, right.location || null, direction);
      case 'deadline':
        return compareValues(left.deadline ?? null, right.deadline ?? null, direction);
      case 'title':
        return compareValues(left.title, right.title, direction);
      case 'discoveredAt':
      default:
        return compareValues(left.discoveredAt, right.discoveredAt, direction);
    }
  });
}

export interface FilterOptions {
  companyTypes: string[];
  regions: string[];
  workModes: string[];
  internshipTypes: string[];
  statuses: string[];
  sources: string[];
  locations: string[];
  technologies: string[];
}

/** Distinct values actually present in the data, used to populate the filter dropdowns. */
export function collectFilterOptions(internships: readonly Internship[]): FilterOptions {
  const gather = (values: Array<string | undefined>): string[] =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())))).sort((a, b) =>
      a.localeCompare(b),
    );

  return {
    companyTypes: gather(internships.map((internship) => internship.companyType)),
    regions: gather(internships.map((internship) => internship.region)),
    workModes: gather(internships.map((internship) => internship.workMode)),
    internshipTypes: gather(internships.map((internship) => internship.internshipType)),
    statuses: gather(internships.map((internship) => internship.status)),
    sources: gather(internships.map((internship) => internship.source)),
    locations: gather(internships.map((internship) => internship.location)),
    technologies: gather(internships.flatMap((internship) => internship.technologies)),
  };
}

/** Paginate a filtered/sorted list, returning the page plus paging metadata. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): { items: T[]; total: number; page: number; pageCount: number } {
  const total = items.length;
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * size;
  return { items: items.slice(start, start + size), total, page: safePage, pageCount };
}

