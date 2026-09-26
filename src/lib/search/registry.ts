import type { SearchSettings } from '@/lib/domain/types';
import type { SearchProviderDescriptor } from './descriptors';
import type { SearchProvider, SearchProviderContext, SearchProviderFactory } from './provider';
import { createArbeitnowProvider } from './providers/arbeitnow';
import { createDemoProvider } from './providers/demo';
import { createHackerNewsProvider } from './providers/hackernews';
import { createRemotiveProvider } from './providers/remotive';
import { createTavilyProvider } from './providers/tavily';

/**
 * Provider registry.
 *
 * The only place that knows the concrete provider implementations. Adding a new discovery
 * source means: write the provider module, add one entry here, done.
 */

interface RegistryEntry {
  descriptor: SearchProviderDescriptor;
  factory: SearchProviderFactory;
}

const REGISTRY: RegistryEntry[] = [
  {
    descriptor: {
      id: 'demo',
      label: 'Demo catalogue (offline)',
      description:
        'Bundled sample internships. Always available and useful to test the workflow without network access.',
      provides: ['location', 'workMode', 'internshipType', 'companyType', 'technology'],
      defaultEnabled: true,
    },
    factory: createDemoProvider,
  },
  {
    descriptor: {
      id: 'arbeitnow',
      label: 'Arbeitnow job board',
      description:
        'Public European job board with a documented JSON API. Loose matching: the configured internship keywords filter the results.',
      provides: ['location', 'technology'],
      docsUrl: 'https://www.arbeitnow.com/blog/job-board-api',
      defaultEnabled: true,
    },
    factory: createArbeitnowProvider,
  },
  {
    descriptor: {
      id: 'hackernews',
      label: 'Hacker News (Who is hiring)',
      description:
        'Public comment search over Hacker News, including the monthly "Who is hiring" threads. Good for smaller companies and agencies.',
      provides: ['technology'],
      docsUrl: 'https://hn.algolia.com/api',
      defaultEnabled: true,
    },
    factory: createHackerNewsProvider,
  },
  {
    descriptor: {
      id: 'remotive',
      label: 'Remotive (remote jobs)',
      description: 'Remote-first job board with a public JSON API. Useful for fully remote internships.',
      provides: ['technology', 'workMode'],
      docsUrl: 'https://remotive.com/api/remote-jobs',
      defaultEnabled: false,
    },
    factory: createRemotiveProvider,
  },
  {
    descriptor: {
      id: 'tavily',
      label: 'Tavily web search',
      description:
        'Real open-web search results through the Tavily API. Requires TAVILY_API_KEY; we only store what the API returns and never scrape pages.',
      requiresEnvVar: 'TAVILY_API_KEY',
      provides: ['country'],
      docsUrl: 'https://docs.tavily.com/documentation/api-reference/endpoint/search',
      defaultEnabled: false,
    },
    factory: createTavilyProvider,
  },
];

export interface ProviderStatus extends SearchProviderDescriptor {
  /** Available in this deployment right now. */
  available: boolean;
  /** Reason the provider cannot run (e.g. missing environment variable). */
  reason?: string;
  enabled: boolean;
}

export function buildProviderContext(
  settings: SearchSettings,
  env: { tavilyApiKey: string | null; contact: string | null },
  fetchImpl?: typeof fetch,
): SearchProviderContext {
  return { settings, env, ...(fetchImpl ? { fetchImpl } : {}) };
}

export function createSearchProviders(
  settings: SearchSettings,
  env: { tavilyApiKey: string | null; contact: string | null },
  fetchImpl?: typeof fetch,
): SearchProvider[] {
  const context = buildProviderContext(settings, env, fetchImpl);
  const enabled = settings.enabledProviders;
  const providers = REGISTRY.filter((entry) => enabled.includes(entry.descriptor.id)).map((entry) =>
    entry.factory(context),
  );
  return providers.filter((provider) => provider.available);
}

export function describeProviders(
  settings: SearchSettings,
  env: { tavilyApiKey: string | null; contact: string | null },
): ProviderStatus[] {
  const context = buildProviderContext(settings, env);
  return REGISTRY.map((entry) => {
    const instance = entry.factory(context);
    const status: ProviderStatus = {
      ...entry.descriptor,
      available: instance.available,
      enabled: settings.enabledProviders.includes(entry.descriptor.id),
    };
    if (!instance.available && entry.descriptor.requiresEnvVar) {
      status.reason = `Set ${entry.descriptor.requiresEnvVar} to enable this provider.`;
    }
    return status;
  });
}

export function knownProviderIds(): string[] {
  return REGISTRY.map((entry) => entry.descriptor.id);
}
