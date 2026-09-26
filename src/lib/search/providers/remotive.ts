import { cleanExternalText } from '@/lib/util/text';
import type { InternshipCandidate, InternshipSearchQuery } from '@/lib/domain/types';
import { asArray, asRecord, asString, fetchJson } from '../http';
import type { SearchProvider, SearchProviderContext, SearchProviderFactory } from '../provider';

/**
 * Remotive remote job board.
 *
 *   GET https://remotive.com/api/remote-jobs?search=<query>&limit=<n>
 *
 * Documented public JSON API (with an explicit legal notice that the listings belong to
 * Remotive and should link back to the original posting, which is exactly what we do).
 */

const ENDPOINT = 'https://remotive.com/api/remote-jobs';

export class RemotiveSearchProvider implements SearchProvider {
  readonly id = 'remotive';
  readonly label = 'Remotive (remote jobs)';
  readonly description =
    'Remote-first job board with a public JSON API. Useful for fully remote internships. No API key required.';
  readonly available = true;

  constructor(private readonly context: SearchProviderContext) {}

  async search(query: InternshipSearchQuery): Promise<InternshipCandidate[]> {
    const limit = query.limit ?? this.context.settings.resultsPerProvider;
    const params = new URLSearchParams({
      search: query.query,
      limit: String(Math.min(50, limit * 2)),
    });
    const payload = await fetchJson<unknown>(`${ENDPOINT}?${params.toString()}`, {
      label: this.label,
      timeoutMs: this.context.settings.timeoutMs,
      fetchImpl: this.context.fetchImpl,
    });

    const jobs = asArray(asRecord(payload).jobs);
    const candidates: InternshipCandidate[] = [];
    for (const job of jobs) {
      const mapped = mapRemotiveJob(asRecord(job));
      if (mapped) candidates.push(mapped);
      if (candidates.length >= limit) break;
    }
    return candidates.slice(0, limit);
  }
}

function mapRemotiveJob(job: Record<string, unknown>): InternshipCandidate | null {
  const title = asString(job.title)?.trim();
  const company = asString(job.company_name)?.trim();
  const url = asString(job.url);
  if (!title || !company || !url) return null;

  const description = cleanExternalText(asString(job.description) ?? '', 8000);
  const tags = asArray(job.tags)
    .map((tag) => asString(tag)?.trim())
    .filter((tag): tag is string => Boolean(tag && tag.length > 1));

  return {
    title,
    company,
    url,
    source: 'remotive',
    sourceId: asString(job.id),
    description,
    location: asString(job.candidate_required_location)?.trim(),
    // The source only lists remote roles: that is a property of the data, not an assumption.
    workMode: 'remote',
    technologies: tags.slice(0, 20),
    compensation: asString(job.salary)?.trim() || undefined,
    rawText: description,
    publishedAt: asString(job.publication_date)?.slice(0, 10),
    extra: {
      provider: 'remotive',
      category: asString(job.category) ?? null,
      jobType: asString(job.job_type) ?? null,
    },
  };
}

export const createRemotiveProvider: SearchProviderFactory = (context) => new RemotiveSearchProvider(context);
