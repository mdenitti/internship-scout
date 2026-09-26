import { reclassifyAllInternships, pruneClassificationReferences } from '@/lib/services/internship-service';
import { enforceRateLimit, jsonError, jsonOk } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Maintenance job: re-derive structured fields (region, work mode, internship type) for every
 * stored internship and drop references to deleted classification values. Run this after
 * editing the registry or the classification aliases.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'maintenance:reclassify', { limit: 10, windowMs: 60_000 });
    const prunedRecords = await pruneClassificationReferences();
    const reclassified = await reclassifyAllInternships();
    return jsonOk({ reclassified, prunedRecords });
  } catch (error) {
    return jsonError(error);
  }
}
