import type { InternshipCandidate, InternshipSearchQuery } from '@/lib/domain/types';
import type { SearchSettings } from '@/lib/domain/types';

/**
 * Search provider abstraction.
 *
 * Providers only ever return *raw candidates*: normalization, duplicate detection and
 * classification happen afterwards in the domain layer. Adding a provider means creating a
 * module that exports a `SearchProviderFactory` and registering it in `registry.ts`.
 *
 * Ground rules every provider must follow (see README):
 *  - only call documented, public HTTP APIs; no HTML scraping
 *  - send a descriptive contact/referrer when the API asks for one
 *  - respect the provider's rate limits (the search service limits concurrency per provider)
 *  - never throw raw errors: raise `AppError` with a user readable message
 */

export interface SearchProvider {
  readonly id: string;
  readonly label: string;
  /** Short description shown in the settings UI. */
  readonly description: string;
  /** Extra environment variable the provider needs (e.g. an API key). */
  readonly requiresEnvVar?: string;
  /** False when the provider cannot run in this deployment (e.g. missing API key). */
  readonly available: boolean;
  search(query: InternshipSearchQuery): Promise<InternshipCandidate[]>;
}

export interface SearchProviderContext {
  settings: SearchSettings;
  env: {
    tavilyApiKey: string | null;
    contact: string | null;
  };
  fetchImpl?: typeof fetch;
}

export type SearchProviderFactory = (context: SearchProviderContext) => SearchProvider;

export interface SearchRunStats {
  providerCount: number;
  rawCandidateCount: number;
  usableCandidateCount: number;
  filteredOutCount: number;
  duplicateCount: number;
  durationMs: number;
}

export interface ProviderRunReport {
  provider: string;
  label: string;
  candidateCount: number;
  durationMs: number;
  error?: { code: string; message: string; retryable: boolean };
}
