import { cleanExternalText } from '@/lib/util/text';
import type { InternshipCandidate, InternshipSearchQuery } from '@/lib/domain/types';
import { asArray, asBoolean, asRecord, asString, fetchJson } from '../http';
import type { SearchProvider, SearchProviderContext, SearchProviderFactory } from '../provider';

/**
 * Arbeitnow public job board API.
 *
 *   GET https://www.arbeitnow.com/api/job-board-api?search=<query>&page=<n>
 *
 * A documented, key-free JSON endpoint (mostly European/DACH + remote roles). Its search is
 * loose, so results are filtered afterwards by the search service using the configured
 * internship keywords and the user's filters.
 */

const ENDPOINT = 'https://www.arbeitnow.com/api/job-board-api';
const MAX_PAGES = 2;

export class ArbeitnowSearchProvider implements SearchProvider {
  readonly id = 'arbeitnow';
  readonly label = 'Arbeitnow job board';
  readonly description =
    'Public European job board with a free JSON API. No API key required; results are filtered by internship keywords.';
  readonly available = true;

  constructor(private readonly context: SearchProviderContext) {}

  async search(query: InternshipSearchQuery): Promise<InternshipCandidate[]> {
    const limit = query.limit ?? this.context.settings.resultsPerProvider;
    const pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(limit / 25)));
    const candidates: InternshipCandidate[] = [];

    for (let page = 1; page <= pages; page += 1) {
      const url = `${ENDPOINT}?search=${encodeURIComponent(query.query)}&page=${page}`;
      const payload = await fetchJson<unknown>(url, {
        label: this.label,
        timeoutMs: this.context.settings.timeoutMs,
        headers: { referer: 'https://internship-scout.local/' },
        fetchImpl: this.context.fetchImpl,
      });
      const items = asArray(asRecord(payload).data);
      for (const item of items) {
        const mapped = mapArbeitnowJob(asRecord(item));
        if (mapped) candidates.push(mapped);
        if (candidates.length >= limit) return candidates;
      }
      if (items.length === 0) break;
    }

    return candidates.slice(0, limit);
  }
}

function mapArbeitnowJob(job: Record<string, unknown>): InternshipCandidate | null {
  const title = asString(job.title)?.trim();
  const company = asString(job.company_name)?.trim();
  const url = asString(job.url);
  if (!title || !company || !url) return null;

  const description = cleanExternalText(asString(job.description) ?? '', 8000);
  const tags = asArray(job.tags)
    .map((tag) => asString(tag)?.trim())
    .filter((tag): tag is string => Boolean(tag && tag.length > 1));
  const jobTypes = asArray(job.job_types)
    .map((type) => asString(type)?.trim())
    .filter((type): type is string => Boolean(type && type.length > 1));

  return {
    title,
    company,
    url,
    source: 'arbeitnow',
    sourceId: asString(job.slug),
    description,
    location: asString(job.location)?.trim(),
    technologies: tags.slice(0, 20),
    skills: jobTypes.slice(0, 10),
    rawText: description,
    publishedAt: toIsoDate(job.created_at),
    extra: {
      remote: asBoolean(job.remote) ?? false,
      provider: 'arbeitnow',
    },
  };
}

function toIsoDate(value: unknown): string | undefined {
  const numeric = typeof value === 'number' ? value : Number(asString(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  const date = new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

export const createArbeitnowProvider: SearchProviderFactory = (context) =>
  new ArbeitnowSearchProvider(context);
