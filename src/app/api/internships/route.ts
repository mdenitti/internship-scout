import { createInternship, listInternships } from '@/lib/services/internship-service';
import { enforceRateLimit, jsonError, jsonOk, readJsonBody, searchParamsFrom } from '@/lib/util/api';
import { filterFromParams, pageFromParams, sortFromParams } from '@/lib/util/search-params';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const params = searchParamsFrom(request);
    const { page, pageSize } = pageFromParams(params);
    const result = await listInternships({
      filter: filterFromParams(params),
      sort: sortFromParams(params),
      page,
      pageSize,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'internships:create', { limit: 30, windowMs: 60_000 });
    const body = await readJsonBody(request);
    const internship = await createInternship(body);
    return jsonOk({ internship }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
