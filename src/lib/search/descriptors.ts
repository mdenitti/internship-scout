import type { ClassificationKind } from '@/lib/domain/types';

/**
 * Configuration for the discovery sources. A provider descriptor describes what an entry
 * in `SearchSettings.enabledProviders` refers to; the actual provider objects are created
 * by `src/lib/search/registry.ts`.
 */

export interface SearchProviderDescriptor {
  id: string;
  label: string;
  description: string;
  /** Environment variable that must be set for the provider to work (keys stay server side). */
  requiresEnvVar?: string;
  /** Which classification kinds this provider's results typically fill in. */
  provides: ClassificationKind[];
  docsUrl?: string;
  /** Providers that work without any credentials and are therefore enabled by default. */
  defaultEnabled: boolean;
}
