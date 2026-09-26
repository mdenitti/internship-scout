import { envConfig } from '@/lib/config/env';
import { normalizeCandidate } from '@/lib/domain/normalize';
import { partitionDuplicates } from '@/lib/domain/dedupe';
import { searchRequestSchema } from '@/lib/domain/schema';
import type {
  Internship,
  InternshipCandidate,
  InternshipPreview,
  InternshipSearchQuery,
  SearchResultItem,
} from '@/lib/domain/types';
import { createSearchProviders, describeProviders, type ProviderStatus } from '@/lib/search/registry';
import type { ProviderRunReport, SearchProvider, SearchRunStats } from '@/lib/search/provider';
import { mapWithConcurrency } from '@/lib/util/concurrency';
import { AppError, errorMessage, isAppError } from '@/lib/util/errors';
import { looseKey } from '@/lib/util/text';
import { getRepositories } from '@/lib/persistence';
import { getSettings } from './settings-service';

/**
 * Search application service.
 *
 * Responsibilities: validate the incoming query, pick providers, run them with a bounded
 * concurrency, normalize whatever comes back, drop non-internships and non-matching results,
 * and flag duplicates. It returns partial results together with per provider errors, so one
 * broken source never breaks the whole search.
 */

export interface SearchRunOutput {
  items: SearchResultItem[];
  providers: ProviderRunReport[];
  availableProviders: ProviderStatus[];
  stats: SearchRunStats;
}

const PROVIDER_CONCURRENCY = 2;

export async function runInternshipSearch(input: unknown): Promise<SearchRunOutput> {
  const parsed = searchRequestSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(
      'VALIDATION_FAILED',
      `Search input is invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid shape'}`,
      { details: parsed.error.issues },
    );
  }

  const settings = await getSettings();
  const env = envConfig();
  const request = parsed.data;
  const providerEnv = { tavilyApiKey: env.tavilyApiKey, contact: settings.search.contact };

  const configured = { ...settings.search, ...(request.limit ? { resultsPerProvider: request.limit } : {}) };

  let providers: SearchProvider[] = createSearchProviders(configured, providerEnv);
  if (request.providers && request.providers.length > 0) {
    providers = providers.filter((provider) => request.providers?.includes(provider.id));
  }

  const availableProviders = describeProviders(settings.search, providerEnv);
  if (providers.length === 0) {
    throw new AppError(
      'CONFIGURATION_ERROR',
      'No search provider is enabled. Enable at least one provider in Settings → Search.',
    );
  }

  const query: InternshipSearchQuery = {
    query: request.query,
    location: request.location,
    country: request.country,
    region: request.region,
    workMode: request.workMode,
    internshipType: request.internshipType,
    companyType: request.companyType,
    technologies: request.technologies,
    publishedAfter: request.publishedAfter,
    limit: configured.resultsPerProvider,
    providers: request.providers,
  };

  const startedAt = Date.now();

  const runs = await mapWithConcurrency(providers, PROVIDER_CONCURRENCY, async (provider) => {
    const providerStartedAt = Date.now();
    try {
      const candidates = await provider.search(query);
      return {
        provider,
        candidates,
        durationMs: Date.now() - providerStartedAt,
      };
    } catch (error) {
      const appError = isAppError(error) ? error : null;
      return {
        provider,
        candidates: [] as InternshipCandidate[],
        durationMs: Date.now() - providerStartedAt,
        error: {
          code: appError?.code ?? 'UPSTREAM_UNAVAILABLE',
          message: errorMessage(error),
          retryable: appError?.retryable ?? true,
        },
      };
    }
  });

  const { classifications, internships: repository } = await getRepositories();
  const values = await classifications.list();
  const existing = await repository.list();

  const reports: ProviderRunReport[] = [];
  const pairs: Array<{ candidate: InternshipCandidate; internship: Internship }> = [];
  let rawCandidateCount = 0;
  let filteredOutCount = 0;

  for (const run of runs) {
    reports.push({
      provider: run.provider.id,
      label: run.provider.label,
      candidateCount: run.candidates.length,
      durationMs: run.durationMs,
      ...(run.error ? { error: run.error } : {}),
    });

    for (const candidate of run.candidates) {
      rawCandidateCount += 1;
      const outcome = normalizeCandidate(candidate, { classifications: values });
      if (!outcome.ok) {
        filteredOutCount += 1;
        continue;
      }
      if (!matchesQuery(outcome.internship, candidate, request, settings.search)) {
        filteredOutCount += 1;
        continue;
      }
      pairs.push({ candidate, internship: outcome.internship });
    }
  }

  const { fresh, duplicates } = partitionDuplicates(
    pairs.map((pair) => pair.internship),
    existing,
  );
  const freshIds = new Set(fresh.map((internship) => internship.id));
  const duplicateByInternshipId = new Map(duplicates.map((entry) => [entry.internship.id, entry.match]));

  const items: SearchResultItem[] = pairs.map((pair) => ({
    candidate: pair.candidate,
    duplicate: duplicateByInternshipId.get(pair.internship.id) ?? null,
    preview: toPreview(pair.internship),
  }));

  return {
    items,
    providers: reports,
    availableProviders,
    stats: {
      providerCount: providers.length,
      rawCandidateCount,
      usableCandidateCount: items.length,
      filteredOutCount,
      duplicateCount: items.length - freshIds.size,
      durationMs: Date.now() - startedAt,
    },
  };
}

type SearchRequest = {
  query: string;
  location?: string;
  country?: string;
  region?: string;
  workMode?: string;
  internshipType?: string;
  companyType?: string;
  technologies?: string[];
  publishedAfter?: string;
};

function toPreview(internship: Internship): InternshipPreview {
  return {
    title: internship.title,
    company: internship.company,
    location: internship.location,
    region: internship.region,
    country: internship.country,
    workMode: internship.workMode,
    internshipType: internship.internshipType,
    companyType: internship.companyType,
    technologies: internship.technologies,
    deadline: internship.deadline,
    duration: internship.duration,
    compensation: internship.compensation,
  };
}

/**
 * Post-filter applied to normalized candidates.
 *
 * Provider APIs match loosely (Arbeitnow happily returns "Engineering Manager" for the query
 * "intern"), so we enforce the configured internship keywords and the user's own filters
 * here. The keyword list lives in the settings, never in the code.
 */
export function matchesQuery(
  internship: Internship,
  candidate: InternshipCandidate,
  request: SearchRequest,
  settings: { internshipKeywords: string[]; requireInternshipKeyword: boolean },
): boolean {
  const text = [
    candidate.title,
    candidate.description ?? '',
    candidate.location ?? '',
    (candidate.technologies ?? []).join(' '),
    (candidate.skills ?? []).join(' '),
  ]
    .join('\n')
    .toLowerCase();

  if (settings.requireInternshipKeyword && settings.internshipKeywords.length > 0) {
    const hasKeyword = settings.internshipKeywords.some((keyword) =>
      text.includes(keyword.toLowerCase().trim()),
    );
    // A provider that already guarantees internships (it classified a type) is trusted.
    if (!hasKeyword && !internship.internshipType) return false;
  }

  const terms = request.query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);
  if (terms.length > 0) {
    const matched = terms.filter((term) => text.includes(term)).length;
    if (matched < Math.ceil(terms.length / 2)) return false;
  }

  if (request.location && !looseKey(internship.location).includes(looseKey(request.location))) return false;
  if (request.region) {
    const matchesRegion =
      looseKey(internship.region ?? '') === looseKey(request.region) ||
      looseKey(internship.location).includes(looseKey(request.region));
    if (!matchesRegion) return false;
  }
  if (request.country && looseKey(internship.country ?? '') !== looseKey(request.country)) return false;
  if (request.workMode && internship.workMode !== request.workMode) return false;
  if (request.internshipType && internship.internshipType !== request.internshipType) return false;
  if (request.companyType && internship.companyType !== request.companyType) return false;

  if (request.technologies && request.technologies.length > 0) {
    const haystack = internship.technologies.map(looseKey);
    const overlap = request.technologies.some((technology) => haystack.includes(looseKey(technology)));
    if (!overlap) return false;
  }

  if (request.publishedAfter) {
    const published =
      candidate.publishedAt ??
      (typeof candidate.extra?.publishedAt === 'string' ? candidate.extra.publishedAt : undefined);
    if (!published || published < request.publishedAfter) return false;
  }

  return true;
}

/** Used by the search console to render provider availability. */
export async function listSearchProviders(): Promise<ProviderStatus[]> {
  const settings = await getSettings();
  const env = envConfig();
  return describeProviders(settings.search, {
    tavilyApiKey: env.tavilyApiKey,
    contact: settings.search.contact,
  });
}
