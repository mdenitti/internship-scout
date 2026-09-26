import { bulkUpdate, type BulkAction } from '@/lib/services/internship-service';
import { bulkRequestSchema } from '@/lib/domain/schema';
import { AppError } from '@/lib/util/errors';
import { enforceRateLimit, jsonError, jsonOk, readJsonBody } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Batch operations: shortlist, reject, set status, clear evaluation, delete. */
export async function POST(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'internships:bulk', { limit: 60, windowMs: 60_000 });
    const parsed = bulkRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AppError(
        'VALIDATION_FAILED',
        `Bulk action is invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid shape'}`,
      );
    }
    const result = await bulkUpdate(parsed.data.ids, parsed.data.action as BulkAction, parsed.data.status);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
