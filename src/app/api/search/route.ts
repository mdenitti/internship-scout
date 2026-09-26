import { listSearchProviders, runInternshipSearch } from '@/lib/services/search-service';
import { enforceRateLimit, jsonError, jsonOk, readJsonBody } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Discovery. Returns per-provider outcomes plus normalized previews of what was found. */
export async function POST(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'search:run', { limit: 20, windowMs: 60_000 });
    const body = await readJsonBody(request);
    const result = await runInternshipSearch(body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

/** Provider availability, used to render the search console. */
export async function GET(): Promise<Response> {
  try {
    return jsonOk({ providers: await listSearchProviders() });
  } catch (error) {
    return jsonError(error);
  }
}
