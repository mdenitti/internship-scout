import { removeDemoData, seedDemoData } from '@/lib/services/internship-service';
import { enforceRateLimit, jsonError, jsonOk } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Add the bundled demo catalogue (flagged as demo data). */
export async function POST(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'seed:create', { limit: 5, windowMs: 60_000 });
    const result = await seedDemoData();
    return jsonOk({
      importedCount: result.imported.length,
      duplicates: result.duplicates.length,
      evaluated: result.evaluated,
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** Remove every record flagged as demo data. */
export async function DELETE(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'seed:delete', { limit: 5, windowMs: 60_000 });
    return jsonOk({ removed: await removeDemoData() });
  } catch (error) {
    return jsonError(error);
  }
}
