import { truncate } from '@/lib/util/text';
import { hostnameOf } from '@/lib/util/url';
import type { InternshipCandidate, InternshipSearchQuery } from '@/lib/domain/types';
import { asArray, asRecord, asString, fetchJson } from '../http';
import type { SearchProvider, SearchProviderContext, SearchProviderFactory } from '../provider';

/**
 * Tavily web search (optional).
 *
 * This is the "open web search" provider: it is a documented search API that returns
 * titles, URLs and snippets. It is deliberately *not* a scraper: we never fetch or parse the
 * result pages, we only store what the API returns, so robots.txt and site terms are
 * respected by construction. Enabled only when TAVILY_API_KEY is configured (server side).
 */

const ENDPOINT = 'https://api.tavily.com/search';

export class TavilySearchProvider implements SearchProvider {
  readonly id = 'tavily';
  readonly label = 'Tavily web search';
  readonly description =
    'Real open-web search results (titles, URLs, snippets) via the Tavily API. Requires TAVILY_API_KEY.';
  readonly requiresEnvVar = 'TAVILY_API_KEY';
  readonly available: boolean;

  constructor(
    private readonly context: SearchProviderContext,
    private readonly apiKey: string,
  ) {
    this.available = apiKey.length > 0;
  }

  async search(query: InternshipSearchQuery): Promise<InternshipCandidate[]> {
    const limit = query.limit ?? this.context.settings.resultsPerProvider;
    const refinedQuery = [
      query.query,
      query.internshipType,
      query.location ?? query.region,
      query.workMode,
      'internship',
    ]
      .filter(Boolean)
      .join(' ');

    const body = {
      api_key: this.apiKey,
      query: refinedQuery,
      search_depth: 'basic',
      max_results: Math.min(20, Math.max(1, limit)),
      include_answer: false,
      include_raw_content: false,
      topic: 'general',
    };

    const payload = await fetchJson<unknown>(ENDPOINT, {
      label: this.label,
      timeoutMs: this.context.settings.timeoutMs,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      fetchImpl: this.context.fetchImpl,
    });

    const results = asArray(asRecord(payload).results);
    const candidates: InternshipCandidate[] = [];
    for (const result of results) {
      const mapped = mapTavilyResult(asRecord(result));
      if (mapped) candidates.push(mapped);
    }
    return candidates.slice(0, limit);
  }
}

function mapTavilyResult(result: Record<string, unknown>): InternshipCandidate | null {
  const url = asString(result.url);
  const rawTitle = asString(result.title)?.trim();
  if (!url || !rawTitle) return null;

  const host = hostnameOf(url) ?? 'web';
  const segments = rawTitle.split(/[-–|]/).map((segment) => segment.trim());
  const company =
    segments.length > 1 && (segments[segments.length - 1]?.length ?? 0) < 50
      ? (segments[segments.length - 1] as string)
      : prettifyHost(host);

  return {
    title: truncate(rawTitle, 200),
    company: truncate(company ?? prettifyHost(host), 120),
    url,
    source: 'tavily',
    sourceId: url,
    description: truncate(asString(result.content) ?? '', 4000),
    rawText: truncate(asString(result.content) ?? '', 4000),
    extra: {
      provider: 'tavily',
      score: typeof result.score === 'number' ? result.score : null,
    },
  };
}

function prettifyHost(host: string): string {
  const base = host.split('.')[0] ?? host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export const createTavilyProvider: SearchProviderFactory = (context) =>
  new TavilySearchProvider(context, context.env.tavilyApiKey ?? '');
