import { referenceCounts } from '@/lib/domain/references';
import { classificationsSchema } from '@/lib/domain/schema';
import { pruneClassificationReferences } from '@/lib/services/internship-service';
import { listClassifications, replaceClassifications, resetClassifications } from '@/lib/services/settings-service';
import { AppError } from '@/lib/util/errors';
import { enforceRateLimit, jsonError, jsonOk, readJsonBody } from '@/lib/util/api';
import { getRepositories } from '@/lib/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The registry plus usage counts, so the editor can warn before deleting a value in use. */
export async function GET(): Promise<Response> {
  try {
    const [values, { internships }] = await Promise.all([listClassifications(), getRepositories()]);
    const all = await internships.list();
    return jsonOk({ values, usage: referenceCounts(values, all) });
  } catch (error) {
    return jsonError(error);
  }
}

/** Replace the registry. References to removed values are pruned from stored internships. */
export async function PUT(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'classifications:update', { limit: 30, windowMs: 60_000 });
    const body = await readJsonBody(request);
    const parsed = classificationsSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AppError(
        'VALIDATION_FAILED',
        `Classification list is invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid shape'}`,
      );
    }
    const values = await replaceClassifications(parsed.data);
    const prunedRecords = await pruneClassificationReferences();
    return jsonOk({ values, prunedRecords });
  } catch (error) {
    return jsonError(error);
  }
}

/** Restore the seeded classification values. */
export async function DELETE(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'classifications:reset', { limit: 5, windowMs: 60_000 });
    const values = await resetClassifications();
    const prunedRecords = await pruneClassificationReferences();
    return jsonOk({ values, prunedRecords });
  } catch (error) {
    return jsonError(error);
  }
}
