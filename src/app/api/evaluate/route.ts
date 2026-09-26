import { evaluateRequestSchema } from '@/lib/domain/schema';
import { evaluateInternships } from '@/lib/services/evaluation-service';
import { AppError } from '@/lib/util/errors';
import { enforceRateLimit, jsonError, jsonOk, readJsonBody } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Evaluate one or many internships with the configured LLM provider.
 *
 * The batch is bounded (max 25 ids per request, concurrency from settings) so a single
 * request cannot flood the free Pollinations tier. Failures are reported per item and never
 * remove the internship from the database.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'evaluate', { limit: 30, windowMs: 60_000 });
    const parsed = evaluateRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AppError(
        'VALIDATION_FAILED',
        `Evaluation request is invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid shape'}`,
      );
    }

    const result = await evaluateInternships(parsed.data.ids, { force: parsed.data.force ?? false });
    return jsonOk({
      results: result.results,
      completed: result.completed,
      failed: result.failed,
      skipped: result.skipped,
      durationMs: result.durationMs,
    });
  } catch (error) {
    return jsonError(error);
  }
}
