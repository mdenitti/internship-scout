import { NextResponse } from 'next/server';

import { envConfig, publicEnvConfig } from '@/lib/config/env';
import { getRepositories } from '@/lib/persistence';
import { jsonError } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health/self-description endpoint. Also used by the UI to show the storage mode banner.
 * Reports *presence* of credentials only, never their value.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const repositories = await getRepositories();
    const env = envConfig();
    return NextResponse.json({
      status: 'ok',
      time: new Date().toISOString(),
      storage: repositories.info,
      config: publicEnvConfig(),
      provider: {
        ai: env.pollinations.provider ?? 'pollinations',
        baseUrl: env.pollinations.baseUrl ?? 'default',
        model: env.pollinations.model ?? 'default',
        apiKeyConfigured: env.pollinations.apiKey !== null,
        webSearchConfigured: env.tavilyApiKey !== null,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
