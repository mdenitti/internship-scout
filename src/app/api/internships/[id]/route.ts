import { deleteInternship, requireInternship, updateInternship } from '@/lib/services/internship-service';
import { enforceRateLimit, jsonError, jsonOk, readJsonBody } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    return jsonOk({ internship: await requireInternship(id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    enforceRateLimit(request, 'internships:update', { limit: 60, windowMs: 60_000 });
    const { id } = await context.params;
    const body = await readJsonBody(request);
    return jsonOk({ internship: await updateInternship(id, body) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    enforceRateLimit(request, 'internships:delete', { limit: 60, windowMs: 60_000 });
    const { id } = await context.params;
    await deleteInternship(id);
    return jsonOk({ deleted: true, id });
  } catch (error) {
    return jsonError(error);
  }
}
