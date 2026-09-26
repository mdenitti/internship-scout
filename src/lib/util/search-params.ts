import type {
  EvaluationStatus,
  InternshipFilter,
  InternshipSort,
  InternshipSortField,
  SortDirection,
} from '@/lib/domain/types';

/**
 * Converts URL query parameters into domain filter/sort objects.
 *
 * List-style filters accept both repeated parameters (`?companyType=a&companyType=b`) and
 * comma separated values (`?companyType=a,b`) so the API is pleasant to use by hand as well.
 */

const EVALUATION_STATUSES: EvaluationStatus[] = [
  'unevaluated',
  'queued',
  'processing',
  'completed',
  'failed',
];

const SORT_FIELDS: InternshipSortField[] = [
  'score',
  'company',
  'location',
  'discoveredAt',
  'deadline',
  'title',
];

function list(params: URLSearchParams, key: string): string[] | undefined {
  const values = params.getAll(key).flatMap((value) => value.split(','));
  const cleaned = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : undefined;
}

function boolean(params: URLSearchParams, key: string): boolean | undefined {
  const value = params.get(key);
  if (value === null) return undefined;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  return undefined;
}

function number(params: URLSearchParams, key: string): number | undefined {
  const value = params.get(key);
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function filterFromParams(params: URLSearchParams): InternshipFilter {
  const evaluationStatus = list(params, 'evaluationStatus')?.filter((value): value is EvaluationStatus =>
    EVALUATION_STATUSES.includes(value as EvaluationStatus),
  );

  const filter: InternshipFilter = {};
  const query = text(params, 'q');
  if (query) filter.text = query;

  const assignList = (key: keyof InternshipFilter, param: string) => {
    const values = list(params, param);
    if (values) (filter as Record<string, unknown>)[key] = values;
  };

  assignList('status', 'status');
  if (evaluationStatus && evaluationStatus.length > 0) filter.evaluationStatus = evaluationStatus;
  assignList('companyType', 'companyType');
  assignList('region', 'region');
  assignList('workMode', 'workMode');
  assignList('internshipType', 'internshipType');
  assignList('technologies', 'technology');
  assignList('sources', 'source');

  const location = text(params, 'location');
  if (location) filter.location = location;
  const company = text(params, 'company');
  if (company) filter.company = company;

  const scoreMin = number(params, 'scoreMin');
  if (scoreMin !== undefined) filter.scoreMin = scoreMin;
  const scoreMax = number(params, 'scoreMax');
  if (scoreMax !== undefined) filter.scoreMax = scoreMax;

  const shortlistedOnly = boolean(params, 'shortlistedOnly');
  if (shortlistedOnly !== undefined) filter.shortlistedOnly = shortlistedOnly;
  const hasEvaluation = boolean(params, 'hasEvaluation');
  if (hasEvaluation !== undefined) filter.hasEvaluation = hasEvaluation;

  const discoveredAfter = text(params, 'discoveredAfter');
  if (discoveredAfter) filter.discoveredAfter = discoveredAfter;
  const deadlineBefore = text(params, 'deadlineBefore');
  if (deadlineBefore) filter.deadlineBefore = deadlineBefore;

  const includeDemo = boolean(params, 'includeDemo');
  if (includeDemo !== undefined) filter.includeDemo = includeDemo;
  const demoOnly = boolean(params, 'demoOnly');
  if (demoOnly !== undefined) filter.demoOnly = demoOnly;

  return filter;
}

export function sortFromParams(
  params: URLSearchParams,
  fallback: InternshipSort = { field: 'score', direction: 'desc' },
): InternshipSort {
  const field = params.get('sort');
  const direction = params.get('direction');
  const resolvedField = SORT_FIELDS.includes(field as InternshipSortField)
    ? (field as InternshipSortField)
    : fallback.field;
  const resolvedDirection: SortDirection =
    direction === 'asc' || direction === 'desc' ? direction : fallback.direction;
  return { field: resolvedField, direction: resolvedDirection };
}

export function pageFromParams(
  params: URLSearchParams,
  fallbackSize = 25,
): { page: number; pageSize: number } {
  const page = number(params, 'page') ?? 1;
  const pageSize = number(params, 'pageSize') ?? fallbackSize;
  return {
    page: Math.max(1, Math.floor(page)),
    pageSize: Math.min(200, Math.max(1, Math.floor(pageSize))),
  };
}

/** Serialize a filter/sort/page state back into a query string (used for shareable links). */
export function toSearchParams(input: {
  filter?: InternshipFilter;
  sort?: InternshipSort;
  page?: number;
  pageSize?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  const { filter = {}, sort, page, pageSize } = input;

  const append = (key: string, values?: string[]) => {
    if (values && values.length > 0) params.set(key, values.join(','));
  };

  if (filter.text) params.set('q', filter.text);
  append('status', filter.status);
  append('evaluationStatus', filter.evaluationStatus);
  append('companyType', filter.companyType);
  append('region', filter.region);
  append('workMode', filter.workMode);
  append('internshipType', filter.internshipType);
  append('technology', filter.technologies);
  append('source', filter.sources);
  if (filter.location) params.set('location', filter.location);
  if (filter.company) params.set('company', filter.company);
  if (filter.scoreMin !== undefined) params.set('scoreMin', String(filter.scoreMin));
  if (filter.scoreMax !== undefined) params.set('scoreMax', String(filter.scoreMax));
  if (filter.shortlistedOnly) params.set('shortlistedOnly', 'true');
  if (filter.hasEvaluation !== undefined) params.set('hasEvaluation', String(filter.hasEvaluation));
  if (filter.discoveredAfter) params.set('discoveredAfter', filter.discoveredAfter);
  if (filter.deadlineBefore) params.set('deadlineBefore', filter.deadlineBefore);
  if (filter.includeDemo !== undefined) params.set('includeDemo', String(filter.includeDemo));
  if (filter.demoOnly) params.set('demoOnly', 'true');
  if (sort) {
    params.set('sort', sort.field);
    params.set('direction', sort.direction);
  }
  if (page && page > 1) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  return params;
}

