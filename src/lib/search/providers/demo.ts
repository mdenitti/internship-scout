import { DEMO_CANDIDATES } from '@/lib/data/demo-internships';
import type { InternshipCandidate, InternshipSearchQuery } from '@/lib/domain/types';
import type { SearchProvider, SearchProviderContext, SearchProviderFactory } from '../provider';

/**
 * Offline demo provider.
 *
 * Serves the bundled demo catalogue so the search screen, the import flow and the evaluation
 * pipeline can be exercised without any network access (and in CI). It is honest about being
 * demo data: every record is flagged `isDemo` on import and the source is `demo`.
 */

export class DemoSearchProvider implements SearchProvider {
  readonly id = 'demo';
  readonly label = 'Demo catalogue (offline)';
  readonly description =
    'Bundled, realistic sample internships. Always available, requires no network access. Imported records are flagged as demo data.';
  readonly available = true;

  constructor(private readonly context: SearchProviderContext) {}

  async search(query: InternshipSearchQuery): Promise<InternshipCandidate[]> {
    const limit = query.limit ?? this.context.settings.resultsPerProvider;
    const terms = query.query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2);

    const matches = DEMO_CANDIDATES.filter((candidate) => {
      if (terms.length === 0) return true;
      const haystack = [
        candidate.title,
        candidate.company,
        candidate.description ?? '',
        (candidate.technologies ?? []).join(' '),
        candidate.location ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });

    return matches.slice(0, limit).map((candidate) => {
      const { discoveredDaysAgo, ...rest } = candidate;
      void discoveredDaysAgo; // demo-only field, never part of a real candidate
      return rest;
    });
  }
}

export const createDemoProvider: SearchProviderFactory = (context) => new DemoSearchProvider(context);
