import { importRequestSchema } from '@/lib/domain/schema';
import { importCandidates } from '@/lib/services/internship-service';
import { AppError } from '@/lib/util/errors';
import { enforceRateLimit, jsonError, jsonOk, readJsonBody } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Import search results. The client sends back the raw candidates it received from
 * `/api/search`; everything is re-validated and re-normalized here, so a tampered payload
 * cannot inject arbitrary records.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    enforceRateLimit(request, 'internships:import', { limit: 20, windowMs: 60_000 });
    const parsed = importRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AppError(
        'VALIDATION_FAILED',
        `Import payload is invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid shape'}`,
      );
    }

    const result = await importCandidates(parsed.data.candidates, {
      isDemo: parsed.data.isDemo ?? false,
    });

    return jsonOk({
      imported: result.imported.map((internship) => ({
        id: internship.id,
        title: internship.title,
        company: internship.company,
        url: internship.url,
      })),
      importedCount: result.imported.length,
      duplicates: result.duplicates,
      skipped: result.skipped,
    });
  } catch (error) {
    return jsonError(error);
  }
}
