import Link from 'next/link';

import { InternshipFilters, type OptionGroup } from '@/components/internships/InternshipFilters';
import { InternshipTable } from '@/components/internships/InternshipTable';
import { Pagination } from '@/components/internships/Pagination';
import { EmptyState } from '@/components/ui/Data';
import { valuesForKind } from '@/lib/domain/classify';
import type { ClassificationKind, ClassificationValue } from '@/lib/domain/types';
import { listInternships } from '@/lib/services/internship-service';
import { getSettings, listClassifications } from '@/lib/services/settings-service';
import { filterFromParams, pageFromParams, sortFromParams } from '@/lib/util/search-params';

export const dynamic = 'force-dynamic';

/**
 * The internships list is a server component: filtering, sorting and pagination all happen
 * server side against the store, so the URL alone fully describes the view. Interactions
 * that need state (selection, bulk actions, the filter form) live in small client islands.
 */
export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
  }

  const [result, values, settings] = await Promise.all([
    listInternships({
      filter: filterFromParams(params),
      sort: sortFromParams(params),
      ...pageFromParams(params),
    }),
    listClassifications(),
    getSettings(),
  ]);

  const groups: OptionGroup[] = [
    { kind: 'status', label: 'Status', values: groupOf(values, 'status') },
    { kind: 'companyType', label: 'Company type', values: groupOf(values, 'companyType') },
    { kind: 'region', label: 'Region', values: groupOf(values, 'region') },
    { kind: 'workMode', label: 'Work mode', values: groupOf(values, 'workMode') },
    { kind: 'internshipType', label: 'Internship type', values: groupOf(values, 'internshipType') },
    {
      kind: 'technology',
      label: 'Technology',
      values: result.filterOptions.technologies.map((technology) => ({
        id: technology,
        label: technology,
        color: 'slate',
      })),
    },
  ];

  const filter = filterFromParams(params);
  const sort = sortFromParams(params);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Internships</h1>
          <p className="mt-1 text-sm text-ink-600">
            {result.total} of {result.allStats.total} records match this view · sorted by {sort.field} ({sort.direction})
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/search"
            className="rounded-[10px] bg-ink-900 px-3.5 py-2 text-sm font-medium text-cream-100 transition-colors hover:bg-ink-800"
          >
            Discover more
          </Link>
        </div>
      </header>

      <InternshipFilters
        filter={filter}
        options={result.filterOptions}
        groups={groups}
        sort={sort}
        total={result.total}
      />

      {result.items.length === 0 ? (
        <EmptyState
          title="No internships match this view"
          description="Adjust the filters above, or discover new opportunities and import them."
          action={
            <Link href="/search" className="text-sm text-clay-600 hover:underline">
              Open the search console →
            </Link>
          }
        />
      ) : (
        <InternshipTable
          items={result.items}
          values={values}
          matchLevels={settings.profile.matchLevels}
          filter={filter}
          sort={sort}
          pageSize={pageFromParams(params).pageSize}
        />
      )}

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        searchParams={raw}
        pageSize={pageFromParams(params).pageSize}
      />
    </div>
  );
}

function groupOf(
  values: ClassificationValue[],
  kind: ClassificationKind,
): OptionGroup['values'] {
  return valuesForKind(values, kind).map((value) => ({
    id: value.id,
    label: value.label,
    color: value.color ?? 'slate',
  }));
}
