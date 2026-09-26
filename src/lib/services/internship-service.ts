import { DEMO_CANDIDATES } from '@/lib/data/demo-internships';
import {
  buildEvaluation,
  recommendationFor,
  effectiveScore,
  isEvaluated,
  isRejected,
  isShortlisted,
} from '@/lib/domain/score';
import { normalizeCandidate, reclassifyInternship, buildDedupeKeys } from '@/lib/domain/normalize';
import { createInternshipSchema, internshipCandidateStrictSchema, internshipPatchSchema } from '@/lib/domain/schema';
import { defaultStatusId, rejectedStatusId, shortlistedStatusId } from '@/lib/domain/classify';
import { partitionDuplicates } from '@/lib/domain/dedupe';
import { filterInternships, sortInternships, collectFilterOptions, paginate, type FilterOptions } from '@/lib/domain/filter';
import { pruneReferences } from '@/lib/domain/references';
import { summarizeInternships } from '@/lib/domain/stats';
import type {
  Internship,
  InternshipCandidate,
  InternshipFilter,
  InternshipSort,
  InternshipStats,
  EvaluationStatus,
  DuplicateMatch,
} from '@/lib/domain/types';
import { AppError } from '@/lib/util/errors';
import { getRepositories } from '@/lib/persistence';
import { HeuristicEvaluationProvider } from '@/lib/ai/heuristic';
import { getSettings } from './settings-service';

/**
 * Application service for internships: the only place that coordinates the domain layer and
 * storage. Route handlers and pages call these functions; they never talk to the repository
 * directly, and they never contain business rules of their own.
 */

export interface ListOptions {
  filter?: InternshipFilter;
  sort?: InternshipSort;
  page?: number;
  pageSize?: number;
}

export interface ListResult {
  items: Internship[];
  total: number;
  page: number;
  pageCount: number;
  filterOptions: FilterOptions;
  stats: InternshipStats;
  allStats: InternshipStats;
}

const DEFAULT_PAGE_SIZE = 25;

export async function listInternships(options: ListOptions = {}): Promise<ListResult> {
  const { internships: repository } = await getRepositories();
  const all = await repository.list();

  const filtered = sortInternships(
    filterInternships(all, options.filter ?? {}),
    options.sort ?? { field: 'score', direction: 'desc' },
  );
  const page = paginate(filtered, options.page ?? 1, options.pageSize ?? DEFAULT_PAGE_SIZE);

  return {
    items: page.items,
    total: page.total,
    page: page.page,
    pageCount: page.pageCount,
    filterOptions: collectFilterOptions(all),
    stats: summarizeInternships(filtered),
    allStats: summarizeInternships(all),
  };
}

export async function getInternship(id: string): Promise<Internship | null> {
  const { internships: repository } = await getRepositories();
  return repository.get(id);
}

export async function requireInternship(id: string): Promise<Internship> {
  const internship = await getInternship(id);
  if (!internship) throw new AppError('NOT_FOUND', 'That internship no longer exists.');
  return internship;
}

export async function getStats(): Promise<InternshipStats> {
  const { internships: repository } = await getRepositories();
  return summarizeInternships(await repository.list());
}

export async function deleteInternship(id: string): Promise<void> {
  const { internships: repository } = await getRepositories();
  const removed = await repository.delete(id);
  if (!removed) throw new AppError('NOT_FOUND', 'That internship no longer exists.');
}

// ── Mutations ───────────────────────────────────────────────────────────────────────────

export async function createInternship(input: unknown): Promise<Internship> {
  const parsed = createInternshipSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(
      'VALIDATION_FAILED',
      `Could not add this internship: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid input'}`,
      { details: parsed.error.issues },
    );
  }

  const { classifications, internships: repository } = await getRepositories();
  const values = await classifications.list();

  const candidate: InternshipCandidate = {
    ...parsed.data,
    source: 'manual',
    technologies: parsed.data.technologies ?? [],
    skills: parsed.data.skills ?? [],
  };

  const outcome = normalizeCandidate(candidate, {
    classifications: values,
    statusId: parsed.data.status ?? defaultStatusId(values),
  });
  if (!outcome.ok) throw new AppError('VALIDATION_FAILED', `Could not add this internship: ${outcome.reason}`);

  const existing = await repository.list();
  const { fresh, duplicates } = partitionDuplicates([outcome.internship], existing);
  if (duplicates.length > 0) {
    throw new AppError(
      'CONFLICT',
      `This internship already exists ("${duplicates[0]?.match.existingCompany} — ${duplicates[0]?.match.existingTitle}").`,
      { details: duplicates[0]?.match },
    );
  }

  await repository.upsertMany(fresh);
  return fresh[0] as Internship;
}

export async function updateInternship(id: string, patch: unknown): Promise<Internship> {
  const parsed = internshipPatchSchema.safeParse(patch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(
      'VALIDATION_FAILED',
      `Could not save changes: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid input'}`,
      { details: parsed.error.issues },
    );
  }

  const { internships: repository, classifications } = await getRepositories();
  const current = await requireInternship(id);
  const values = await classifications.list();
  const data = parsed.data;

  const next: Internship = {
    ...current,
    ...Object.fromEntries(
      Object.entries(data).filter(([key, value]) => value !== undefined && key !== 'reclassify'),
    ),
    updatedAt: new Date().toISOString(),
  };

  // Keep derived/dedupe data consistent with the new values.
  next.country = next.country?.toUpperCase();
  next.dedupe = buildDedupeKeys({
    url: next.url,
    company: next.company,
    title: next.title,
    location: next.location,
  });

  const final = data.reclassify ? reclassifyInternship(next, values) : next;
  await repository.upsertMany([final]);
  return final;
}

export type BulkAction = 'status' | 'shortlist' | 'reject' | 'delete' | 'clear-evaluation' | 'reset-status';

export interface BulkResult {
  affected: number;
  action: BulkAction;
}

export async function bulkUpdate(ids: readonly string[], action: BulkAction, statusId?: string): Promise<BulkResult> {
  if (ids.length === 0) throw new AppError('BAD_REQUEST', 'Select at least one internship first.');
  const { internships: repository, classifications } = await getRepositories();
  const values = await classifications.list();

  if (action === 'delete') {
    const affected = await repository.deleteMany(ids);
    return { affected, action };
  }

  const records = await repository.list({ ids: [...ids] });
  if (records.length === 0) throw new AppError('NOT_FOUND', 'None of the selected internships exist any more.');

  const now = new Date().toISOString();
  const updated = records.map((internship) => {
    switch (action) {
      case 'shortlist':
        return { ...internship, status: shortlistedStatusId(values), updatedAt: now };
      case 'reject':
        return { ...internship, status: rejectedStatusId(values), updatedAt: now };
      case 'reset-status':
        return { ...internship, status: defaultStatusId(values), updatedAt: now };
      case 'clear-evaluation':
        return {
          ...internship,
          evaluation: null,
          evaluationStatus: 'unevaluated' as EvaluationStatus,
          evaluationError: null,
          updatedAt: now,
        };
      case 'status': {
        if (!statusId) throw new AppError('BAD_REQUEST', 'A status value is required for this action.');
        return { ...internship, status: statusId, updatedAt: now };
      }
      default:
        return internship;
    }
  });

  await repository.upsertMany(updated);
  return { affected: updated.length, action };
}

// ── Import / seed ───────────────────────────────────────────────────────────────────────

export interface ImportOptions {
  /** Provider that produced the candidates (stored on the record). */
  source?: string;
  /** Mark the imported records as demo data. */
  isDemo?: boolean;
  /** Timestamps to assign, used by the demo seeder to spread "discovered" dates. */
  discoveredAt?: string;
}

export interface ImportResult {
  imported: Internship[];
  duplicates: Array<{ title: string; company: string; match: DuplicateMatch }>;
  skipped: Array<{ title: string; company: string; reason: string }>;
}

/**
 * Normalize + deduplicate + store a batch of candidates.
 *
 * Nothing is dropped silently: invalid candidates come back in `skipped` and duplicates in
 * `duplicates`, both with a reason the UI can show.
 */
export async function importCandidates(
  candidates: readonly unknown[],
  options: ImportOptions = {},
): Promise<ImportResult> {
  if (candidates.length === 0) return { imported: [], duplicates: [], skipped: [] };

  const { internships: repository, classifications } = await getRepositories();
  const values = await classifications.list();

  const normalized: Internship[] = [];
  const skipped: ImportResult['skipped'] = [];

  for (const raw of candidates) {
    const parsed = internshipCandidateStrictSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const record = (raw ?? {}) as Partial<InternshipCandidate>;
      skipped.push({
        title: typeof record.title === 'string' ? record.title : '(untitled)',
        company: typeof record.company === 'string' ? record.company : '(unknown)',
        reason: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'invalid candidate',
      });
      continue;
    }

    const outcome = normalizeCandidate(
      { ...(parsed.data as InternshipCandidate), ...(options.source ? { source: options.source } : {}) },
      { classifications: values, statusId: defaultStatusId(values) },
    );
    if (!outcome.ok) {
      skipped.push({ title: parsed.data.title, company: parsed.data.company, reason: outcome.reason });
      continue;
    }

    if (options.discoveredAt) {
      outcome.internship.discoveredAt = options.discoveredAt;
      outcome.internship.updatedAt = options.discoveredAt;
    }
    if (options.isDemo) outcome.internship.isDemo = true;
    normalized.push(outcome.internship);
  }

  const existing = await repository.list();
  const { fresh, duplicates } = partitionDuplicates(normalized, existing);
  await repository.upsertMany(fresh);

  return {
    imported: fresh,
    duplicates: duplicates.map((entry) => ({
      title: entry.internship.title,
      company: entry.internship.company,
      match: entry.match,
    })),
    skipped,
  };
}

/**
 * Seed the demo catalogue. Demo records go through the exact same normalization pipeline as
 * scraped candidates, then get scored with the deterministic evaluator (no network calls) so
 * the ranking UI is immediately meaningful. Re-run any of them with the LLM from the UI.
 */
export async function seedDemoData(): Promise<ImportResult & { evaluated: number }> {
  const now = Date.now();
  const { internships: repository, classifications } = await getRepositories();
  const values = await classifications.list();
  const settings = await getSettings();

  const normalized: Internship[] = [];
  for (const seed of DEMO_CANDIDATES) {
    const discoveredAt = new Date(now - seed.discoveredDaysAgo * 24 * 60 * 60 * 1000).toISOString();
    const outcome = normalizeCandidate(seed, { classifications: values, statusId: defaultStatusId(values) });
    if (!outcome.ok) continue;
    outcome.internship.discoveredAt = discoveredAt;
    outcome.internship.updatedAt = discoveredAt;
    outcome.internship.isDemo = true;
    normalized.push(outcome.internship);
  }

  const existing = await repository.list();
  const { fresh, duplicates } = partitionDuplicates(normalized, existing);

  const heuristic = new HeuristicEvaluationProvider(values);
  const withEvaluations: Internship[] = [];
  for (const internship of fresh) {
    try {
      const draft = await heuristic.evaluateInternship({
        internship,
        profile: settings.profile,
        settings: settings.ai,
      });
      const evaluation = buildEvaluation({
        modelCriteria: draft.modelCriteria,
        reasons: draft.reasons,
        concerns: draft.concerns,
        recommendation: draft.recommendation,
        summary: draft.summary,
        profile: settings.profile,
        provider: heuristic.id,
        model: heuristic.model,
        ...(draft.raw ? { raw: draft.raw } : {}),
        fallback: true,
      });
      withEvaluations.push({
        ...internship,
        evaluation: {
          ...evaluation,
          recommendation: recommendationFor(evaluation.score, settings.profile, draft.recommendation),
        },
        evaluationStatus: 'completed',
      });
    } catch {
      withEvaluations.push(internship);
    }
  }

  const toStore = withEvaluations.length > 0 ? withEvaluations : fresh;
  await repository.upsertMany(toStore);

  return {
    imported: toStore,
    duplicates: duplicates.map((entry) => ({
      title: entry.internship.title,
      company: entry.internship.company,
      match: entry.match,
    })),
    skipped: [],
    evaluated: toStore.filter(isEvaluated).length,
  };
}

export async function removeDemoData(): Promise<number> {
  const { internships: repository } = await getRepositories();
  return repository.deleteDemo();
}

/**
 * Drop references to classification values that no longer exist, so internships never point
 * at a value that was removed from the registry.
 */
export async function pruneClassificationReferences(): Promise<number> {
  const { internships: repository, classifications } = await getRepositories();
  const values = await classifications.list();
  const all = await repository.list();

  const updated = all
    .map((internship) => pruneReferences(internship, values))
    .filter((result) => result.changed)
    .map((result) => result.internship);

  if (updated.length > 0) await repository.upsertMany(updated);
  return updated.length;
}

/** Re-derive location/work mode/type for every record (used after registry or profile edits). */
export async function reclassifyAllInternships(): Promise<number> {
  const { internships: repository, classifications } = await getRepositories();
  const values = await classifications.list();
  const all = await repository.list();
  const updated = all.map((internship) => reclassifyInternship(internship, values));
  await repository.upsertMany(updated);
  return updated.length;
}

export { effectiveScore, isShortlisted, isRejected };
