import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InternshipDetail } from '@/components/internships/InternshipDetail';
import { getInternship } from '@/lib/services/internship-service';
import { getSettings, listClassifications } from '@/lib/services/settings-service';

export const dynamic = 'force-dynamic';

/** Single internship: facts, description, evaluation report and the edit/evaluate actions. */
export default async function InternshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const internship = await getInternship(id);
  if (!internship) notFound();

  const [values, settings] = await Promise.all([listClassifications(), getSettings()]);

  return (
    <div className="space-y-5">
      <Link href="/internships" className="inline-block text-sm text-ink-600 hover:text-clay-600">
        ← Back to internships
      </Link>
      <InternshipDetail internship={internship} values={values} settings={settings} />
    </div>
  );
}
