/**
 * Reads and normalizes environment configuration. Server-side only: this module must
 * never be imported from a client component. Secrets are only ever exposed to the server
 * services that perform the outbound request.
 */

export interface EnvConfig {
  databaseUrl: string | null;
  dataFilePath: string | null;
  isVercel: boolean;
  pollinations: {
    apiKey: string | null;
    baseUrl: string | null;
    model: string | null;
    provider: 'pollinations' | 'heuristic' | null;
  };
  tavilyApiKey: string | null;
  seedDemoData: boolean;
  contact: string | null;
}

function nonEmpty(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function envConfig(): EnvConfig {
  const provider = nonEmpty(process.env.AI_PROVIDER);
  return {
    databaseUrl: nonEmpty(process.env.DATABASE_URL) ?? nonEmpty(process.env.POSTGRES_URL),
    dataFilePath: nonEmpty(process.env.DATA_FILE_PATH),
    isVercel: Boolean(nonEmpty(process.env.VERCEL) ?? nonEmpty(process.env.VERCEL_ENV)),
    pollinations: {
      apiKey: nonEmpty(process.env.POLLINATIONS_API_KEY),
      baseUrl: nonEmpty(process.env.POLLINATIONS_BASE_URL),
      model: nonEmpty(process.env.POLLINATIONS_MODEL),
      provider: provider === 'heuristic' || provider === 'pollinations' ? provider : null,
    },
    tavilyApiKey: nonEmpty(process.env.TAVILY_API_KEY),
    seedDemoData: parseBoolean(process.env.SEED_DEMO_DATA, true),
    contact: nonEmpty(process.env.APP_CONTACT),
  };
}

/** Safe subset that may be sent to the browser (no secrets, only presence flags). */
export interface PublicEnvConfig {
  llmKeyConfigured: boolean;
  webSearchKeyConfigured: boolean;
  databaseConfigured: boolean;
  isVercel: boolean;
  defaultBaseUrl: string | null;
  defaultModel: string | null;
  defaultProvider: string | null;
}

export function publicEnvConfig(): PublicEnvConfig {
  const config = envConfig();
  return {
    llmKeyConfigured: config.pollinations.apiKey !== null,
    webSearchKeyConfigured: config.tavilyApiKey !== null,
    databaseConfigured: config.databaseUrl !== null,
    isVercel: config.isVercel,
    defaultBaseUrl: config.pollinations.baseUrl,
    defaultModel: config.pollinations.model,
    defaultProvider: config.pollinations.provider,
  };
}
