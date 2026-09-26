import { getStats } from '@/lib/services/internship-service';
import { getRepositories } from '@/lib/persistence';
import { jsonError, jsonOk } from '@/lib/util/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [stats, repositories] = await Promise.all([getStats(), getRepositories()]);
    return jsonOk({ stats, storage: repositories.info });
  } catch (error) {
    return jsonError(error);
  }
}
