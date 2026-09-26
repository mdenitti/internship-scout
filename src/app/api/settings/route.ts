import { envConfig } from '@/lib/config/env';
import { settingsPatchSchema } from '@/lib/domain/schema';
import { describeActiveProvider } from '@/lib/services/evaluation-service';
import { getSettings, resetSettings, updateSettings } from '@/lib/services/settings-service';
import { AppError } from '@/lib/util/errors';
import { enforceRateLimit, jsonError, jsonOk, readJsonBody } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [settings, provider, env] = await Promise.all([
      getSettings(),
      describeActiveProvider(),
      Promise.resolve(envConfig()),
    ]);
    return jsonOk({
      settings,
      provider,
      secrets: {
        llmApiKeyConfigured: env.pollinations.apiKey !== null,
        webSearchKeyConfigured: env.tavilyApiKey !== null,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'settings:update', { limit: 60, windowMs: 60_000 });
    const parsed = settingsPatchSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AppError(
        'VALIDATION_FAILED',
        `Settings update is invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid shape'}`,
      );
    }
    const settings = await updateSettings(parsed.data);
    return jsonOk({ settings });
  } catch (error) {
    return jsonError(error);
  }
}

/** Reset to the seeded defaults (environment variables are re-applied). */
export async function DELETE(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'settings:reset', { limit: 5, windowMs: 60_000 });
    return jsonOk({ settings: await resetSettings() });
  } catch (error) {
    return jsonError(error);
  }
}
