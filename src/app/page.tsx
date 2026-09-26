import Link from 'next/link';

import { DataActions } from '@/components/settings/DataActions';
import { Badge, Card, CardHeader, DemoBadge, MatchLevelBadge, StatusBadge } from '@/components/ui/Card';
import { EmptyState, ScorePill, SimpleBarList, StatGrid } from '@/components/ui/Data';
import { labelFor } from '@/lib/domain/classify';
import { effectiveMatchLevel, effectiveScore } from '@/lib/domain/score';
import { listInternships } from '@/lib/services/internship-service';
import { getSettings, listClassifications } from '@/lib/services/settings-service';

export const dynamic = 'force-dynamic';

/**
 * Dashboard: summary numbers, score distribution and the best matches so far. A server
 * component that reads the service layer directly, so the first paint already contains the
 * data (no client fetching, no loading spinners).
 */
export default async function DashboardPage() {
  const [{ items, allStats, filterOptions }, classifications, settings] = await Promise.all([
    listInternships({ sort: { field: 'score', direction: 'desc' }, pageSize: 8 }),
    listClassifications(),
    getSettings(),
  ]);

  const topMatches = items.filter((internship) => effectiveScore(internship) !== null).slice(0, 5);
  const recent = [...items].sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt)).slice(0, 5);
  const shortlisted = items.filter((internship) => /shortlist|favorite|favourite|starred/i.test(internship.status));

  const matchLevelLabel = (level: string | null): string | undefined => {
    if (!level) return undefined;
    return settings.profile.matchLevels.find((entry) => entry.id === level)?.label ?? level;
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Internship dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">
            Search for internships, normalize what you find, score it against your profile with the free
            Pollinations LLM, then shortlist and edit by hand. Active profile:{' '}
            <strong>{settings.profile.name}</strong> (minimum relevance {settings.profile.minRelevance}).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/search"
            className="rounded-[10px] bg-ink-900 px-3.5 py-2 text-sm font-medium text-cream-100 transition-colors hover:bg-ink-800"
          >
            Discover internships
          </Link>
          <Link
            href="/internships"
            className="rounded-[10px] border border-cream-400 bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:border-ink-500"
          >
            Review all
          </Link>
        </div>
      </header>

      <StatGrid stats={allStats} />

      {allStats.total === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Run a search to discover internships, add one by hand, or load the demo catalogue to explore the workflow with realistic sample data."
          action={<DataActions demoCount={allStats.demoCount} />}
        />
      ) : null}

      {allStats.total > 0 ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Best matches"
              description="Ranked by effective score — a manual override always wins over the AI score."
              action={
                <Link
                  href="/internships?sort=score&direction=desc"
                  className="text-xs text-clay-600 hover:underline"
                >
                  View ranked list →
                </Link>
              }
            />
            {topMatches.length === 0 ? (
              <p className="text-sm text-ink-600">
                Nothing has been evaluated yet. Open an internship and press “Evaluate with AI”, or evaluate in
                bulk from the internships list.
              </p>
            ) : (
              <ul className="divide-y divide-cream-200">
                {topMatches.map((internship) => (
                  <li key={internship.id} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                    <ScorePill score={effectiveScore(internship)} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/internships/${internship.id}`} className="font-medium hover:text-clay-600">
                        {internship.title}
                      </Link>
                      <p className="text-xs text-ink-600">
                        {internship.company}
                        {internship.location ? ` · ${internship.location}` : ''}
                      </p>
                      {internship.evaluation?.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs text-ink-600">{internship.evaluation.summary}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <MatchLevelBadge
                        level={effectiveMatchLevel(internship)}
                        label={matchLevelLabel(effectiveMatchLevel(internship))}
                      />
                      <StatusBadge
                        status={internship.status}
                        label={labelFor(classifications, 'status', internship.status) ?? internship.status}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Score distribution" description="Effective score buckets." />
              <SimpleBarList
                items={allStats.scoreBuckets.map((bucket) => ({ label: bucket.label, count: bucket.count }))}
              />
            </Card>

            <Card>
              <CardHeader title="Company types" description="From the configurable classifications." />
              <SimpleBarList
                items={allStats.byCompanyType.map((entry) => ({
                  label: labelFor(classifications, 'companyType', entry.value) ?? entry.value,
                  count: entry.count,
                }))}
                emptyLabel="No company type detected yet."
              />
            </Card>

            <Card>
              <CardHeader title="Work modes" />
              <SimpleBarList
                items={allStats.byWorkMode.map((entry) => ({
                  label: labelFor(classifications, 'workMode', entry.value) ?? entry.value,
                  count: entry.count,
                }))}
                emptyLabel="No work mode detected yet."
              />
            </Card>
          </div>
        </div>
      ) : null}
      {allStats.total > 0 ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Recently discovered" description="Newest records first." />
            <ul className="divide-y divide-cream-200">
              {recent.map((internship) => (
                <li key={internship.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-20 shrink-0 text-xs text-ink-500">{internship.discoveredAt.slice(0, 10)}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/internships/${internship.id}`} className="truncate text-sm hover:text-clay-600">
                      {internship.title}
                    </Link>
                    <p className="text-[11px] text-ink-500">
                      {internship.company} · source: {internship.source}
                    </p>
                  </div>
                  {internship.isDemo ? <DemoBadge /> : null}
                  {internship.evaluationStatus === 'failed' ? (
                    <Badge color="terracotta">evaluation failed</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Shortlist" description={`${shortlisted.length} of ${allStats.total} selected`} />
            {shortlisted.length === 0 ? (
              <p className="text-sm text-ink-600">
                Use the checkboxes in the internships list to shortlist candidates in bulk.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {shortlisted.map((internship) => (
                  <li key={internship.id} className="flex items-center justify-between gap-3">
                    <Link href={`/internships/${internship.id}`} className="truncate hover:text-clay-600">
                      {internship.company}
                    </Link>
                    <ScorePill score={effectiveScore(internship)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {filterOptions.locations.length > 0 ? (
        <p className="text-[11px] text-ink-500">
          Tracking {filterOptions.locations.length} locations and {filterOptions.technologies.length} technologies
          across {allStats.bySource.length} sources.
        </p>
      ) : null}
    </div>
  );
}
