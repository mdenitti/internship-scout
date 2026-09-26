import { cleanExternalText, truncate } from '@/lib/util/text';
import type { InternshipCandidate, InternshipSearchQuery } from '@/lib/domain/types';
import { asArray, asRecord, asString, fetchJson } from '../http';
import type { SearchProvider, SearchProviderContext, SearchProviderFactory } from '../provider';

/**
 * Hacker News (Algolia) search.
 *
 *   GET https://hn.algolia.com/api/v1/search?query=...&tags=comment
 *
 * The monthly "Ask HN: Who is hiring?" threads are a well known source of internship posts.
 * The Algolia API is public and documented; the payload contains the comment text as data,
 * which we still treat as untrusted (it is stripped of HTML and truncated).
 *
 * The permalink of the comment is stored as the record URL: it links straight to the post
 * with the company's application instructions.
 */

const ENDPOINT = 'https://hn.algolia.com/api/v1/search';
const LOOKBACK_DAYS = 240;

export class HackerNewsSearchProvider implements SearchProvider {
  readonly id = 'hackernews';
  readonly label = 'Hacker News (Who is hiring)';
  readonly description =
    'Searches public Hacker News comment threads, including the monthly "Who is hiring" posts. No API key required.';
  readonly available = true;

  constructor(private readonly context: SearchProviderContext) {}

  async search(query: InternshipSearchQuery): Promise<InternshipCandidate[]> {
    const limit = query.limit ?? this.context.settings.resultsPerProvider;
    const createdAfter = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 60 * 60;
    const params = new URLSearchParams({
      query: query.query,
      tags: 'comment',
      hitsPerPage: String(Math.min(50, limit * 3)),
      numericFilters: `created_at_i>${createdAfter}`,
    });

    const payload = await fetchJson<unknown>(`${ENDPOINT}?${params.toString()}`, {
      label: this.label,
      timeoutMs: this.context.settings.timeoutMs,
      fetchImpl: this.context.fetchImpl,
    });

    const hits = asArray(asRecord(payload).hits);
    const candidates: InternshipCandidate[] = [];
    for (const hit of hits) {
      const mapped = mapComment(asRecord(hit));
      if (mapped) candidates.push(mapped);
      if (candidates.length >= limit) break;
    }
    return candidates.slice(0, limit);
  }
}

/**
 * First lines that are a call-to-action or a location are not a company name, e.g.
 * "SEEKING WORK | Full Stack Developer | California" or "Remote | Intern | Berlin".
 * Commenters that are not companies themselves (agencies, recruiters) frequently post these,
 * and we would rather show them as an unattributed comment than invent a company.
 */
const NON_COMPANY_HEADERS =
  /^(seeking|seeking\s+work|hiring|we'?re\s+hiring|apply|applicants|job\s+post|jobs|remote|hybrid|onsite|on-?site|full[- ]?time|part[- ]?time|freelance|contract|internship|intern|graduate|senior|junior|mid[- ]level|worldwide|anywhere|multiple|open\s+positions?)\b/i;

/** Things that are clearly locations or work modes, not company names. */
const LOCATION_HEADERS =
  /^(remote|hybrid|on-?site|anywhere|worldwide|europe|emea|usa|u\.?s\.?a\.?|uk|united\s+(kingdom|states|states of america|canada)|canada|germany|france|netherlands|spain|italy|ireland|sweden|poland|portugal|australia|india|brazil|israel|switzerland|austria|denmark|belgium|turkey|latam|apac|americas|california|new\s+york|texas|washington|colorado|berlin|amsterdam|london|paris|dublin|toronto|zurich|stockholm|lisbon|madrid|milano|barcelona|brussels|vienna)\b/i;

/**
 * Split the conventional "Company | Role | Location | ..." first line of hiring comments.
 * Exported for tests.
 */
export function parseHiringLine(text: string): { company?: string; role?: string; location?: string } {
  const firstLine = text.split('\n')[0] ?? '';
  const parts = firstLine
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2 && (parts[0]?.length ?? 0) <= 60) {
    return { company: parts[0], role: parts[1], location: parts[2] };
  }
  return {};
}

/** Is the first pipe-separated part plausibly a company name? Exported for tests. */
export function looksLikeCompany(part: string | undefined): boolean {
  if (!part) return false;
  if (NON_COMPANY_HEADERS.test(part) || LOCATION_HEADERS.test(part)) return false;
  if (LOCATION_HEADERS.test(part.split(/[,(]/)[0] ?? '')) return false;
  if (!/[a-z]/i.test(part)) return false;
  // A single "word" that is also a month, a country or a bare level is a header, not a name.
  return true;
}

/** Map one Algolia comment hit to a candidate. Exported for tests. */
export function mapComment(hit: Record<string, unknown>): InternshipCandidate | null {
  const id = asString(hit.objectID);
  const text = cleanExternalText(asString(hit.comment_text) ?? '', 8000);
  if (!id || text.length < 40) return null;

  const parsed = parseHiringLine(text);

  // The Algolia search matches any comment that merely mentions the query. Keep only
  // comments from hiring threads (or ones using the "Company | Role | ..." convention) so
  // the console does not fill up with unrelated discussions.
  const storyTitle = asString(hit.story_title) ?? '';
  const looksLikeHiring = /hiring|freelanc/i.test(storyTitle) || parsed.company !== undefined;
  if (!looksLikeHiring) return null;

  // A pipe-separated first part that is a call-to-action or a location ("SEEKING WORK |",
  // "Remote |") is not a company. Such comments are kept, but attributed to their author.
  const company = looksLikeCompany(parsed.company) ? parsed.company : undefined;
  const title = truncate(parsed.role ?? text.split('\n')[0] ?? 'Hacker News hiring comment', 200);
  const companyName = truncate(company ?? `Comment by ${asString(hit.author) ?? 'unknown'}`, 120);
  if (!title || !companyName) return null;

  return {
    title,
    company: companyName,
    url: `https://news.ycombinator.com/item?id=${encodeURIComponent(id)}`,
    source: 'hackernews',
    sourceId: id,
    description: text,
    location: parsed.location,
    rawText: text,
    publishedAt: asString(hit.created_at)?.slice(0, 10),
    extra: {
      provider: 'hackernews',
      storyTitle: asString(hit.story_title) ?? null,
      author: asString(hit.author) ?? null,
    },
  };
}

export const createHackerNewsProvider: SearchProviderFactory = (context) =>
  new HackerNewsSearchProvider(context);
