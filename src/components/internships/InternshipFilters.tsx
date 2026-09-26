'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Form';
import type { FilterOptions } from '@/lib/domain/filter';
import type { InternshipFilter, InternshipSortField, SortDirection } from '@/lib/domain/types';
import { toSearchParams } from '@/lib/util/search-params';

export interface OptionGroup {
  kind: string;
  label: string;
  values: Array<{ id: string; label: string; color: string; count?: number }>;
}

/**
 * Filter panel for the internships list. All state is mirrored into the URL, so a filtered
 * view can be bookmarked or shared, and the page itself stays a server component.
 */
export function InternshipFilters({
  filter,
  options,
  groups,
  sort,
  total,
}: {
  filter: InternshipFilter;
  options: FilterOptions;
  groups: OptionGroup[];
  sort: { field: InternshipSortField; direction: SortDirection };
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<InternshipFilter>({
    text: filter.text ?? '',
    company: filter.company ?? '',
    location: filter.location ?? '',
    scoreMin: filter.scoreMin,
    scoreMax: filter.scoreMax,
    shortlistedOnly: filter.shortlistedOnly ?? false,
    hasEvaluation: filter.hasEvaluation,
    companyType: filter.companyType ?? [],
    region: filter.region ?? [],
    workMode: filter.workMode ?? [],
    internshipType: filter.internshipType ?? [],
    technologies: filter.technologies ?? [],
    status: filter.status ?? [],
    includeDemo: filter.includeDemo,
  });
  const [sortDraft, setSortDraft] = useState(sort);
  const [open, setOpen] = useState(false);

  const selectedFor = (kind: string): string[] =>
    (draft[groupKindToFilterKey(kind)] as string[] | undefined) ?? [];

  const activeCount = useMemo(() => {
    let count = 0;
    if (draft.text) count += 1;
    if (draft.company) count += 1;
    if (draft.location) count += 1;
    if (draft.scoreMin !== undefined || draft.scoreMax !== undefined) count += 1;
    if (draft.shortlistedOnly) count += 1;
    if (draft.hasEvaluation !== undefined) count += 1;
    for (const group of groups) count += selectedFor(group.kind).length;
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, groups]);

  function navigate(nextFilter: InternshipFilter, nextSort = sortDraft) {
    const params = toSearchParams({
      filter: pruneDraft(nextFilter),
      sort: nextSort,
      pageSize: Number(searchParams.get('pageSize') ?? '') || undefined,
    });
    const query = params.toString();
    router.push(query ? `/internships?${query}` : '/internships');
  }

  function toggle(kind: string, id: string) {
    const key = groupKindToFilterKey(kind);
    const current = selectedFor(kind);
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    setDraft({ ...draft, [key]: next });
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Search text" className="min-w-52 flex-1">
          <Input
            value={draft.text ?? ''}
            placeholder="title, company, technology, notes…"
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') navigate(draft);
            }}
          />
        </Field>

        <Field label="Sort">
          <Select
            value={sortDraft.field}
            onChange={(event) => {
              const next = { ...sortDraft, field: event.target.value as InternshipSortField };
              setSortDraft(next);
              navigate(draft, next);
            }}
            options={[
              { value: 'score', label: 'Effective score' },
              { value: 'discoveredAt', label: 'Discovered date' },
              { value: 'deadline', label: 'Application deadline' },
              { value: 'company', label: 'Company' },
              { value: 'location', label: 'Location' },
              { value: 'title', label: 'Title' },
            ]}
          />
        </Field>

        <Field label="Direction">
          <Select
            value={sortDraft.direction}
            onChange={(event) => {
              const next = { ...sortDraft, direction: event.target.value as SortDirection };
              setSortDraft(next);
              navigate(draft, next);
            }}
            options={[
              { value: 'desc', label: 'Descending' },
              { value: 'asc', label: 'Ascending' },
            ]}
          />
        </Field>

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => navigate(draft)}>
            Apply
          </Button>
          <Button variant="ghost" onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide filters' : `More filters${activeCount > 0 ? ` (${activeCount})` : ''}`}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-cream-200 pt-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Company contains">
              <Input
                value={draft.company ?? ''}
                onChange={(event) => setDraft({ ...draft, company: event.target.value })}
              />
            </Field>
            <Field label="Location contains">
              <Input
                value={draft.location ?? ''}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
              />
            </Field>
            <Field label="Score from">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.scoreMin ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    scoreMin: event.target.value === '' ? undefined : Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="Score to">
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.scoreMax ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    scoreMax: event.target.value === '' ? undefined : Number(event.target.value),
                  })
                }
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-end gap-5">
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-clay-500"
                checked={draft.shortlistedOnly ?? false}
                onChange={(event) => setDraft({ ...draft, shortlistedOnly: event.target.checked })}
              />
              Shortlisted only
            </label>
            <Field label="Evaluation state">
              <Select
                value={draft.hasEvaluation === undefined ? '' : String(draft.hasEvaluation)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    hasEvaluation: event.target.value === '' ? undefined : event.target.value === 'true',
                  })
                }
                options={[
                  { value: 'true', label: 'Only evaluated' },
                  { value: 'false', label: 'Only not evaluated' },
                ]}
                placeholder="Any"
              />
            </Field>
            <Field label="Demo data">
              <Select
                value={draft.includeDemo === undefined ? '' : String(draft.includeDemo)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    includeDemo: event.target.value === '' ? undefined : event.target.value === 'true',
                  })
                }
                options={[
                  { value: 'true', label: 'Include demo data' },
                  { value: 'false', label: 'Hide demo data' },
                ]}
                placeholder="Include"
              />
            </Field>
          </div>

          {groups.map((group) => (
            <div key={group.kind}>
              <p className="field-label">{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.values.length === 0 ? (
                  <span className="text-xs text-ink-500">
                    No values yet — add them in Settings → Classifications.
                  </span>
                ) : null}
                {group.values.map((value) => {
                  const selected = selectedFor(group.kind).includes(value.id);
                  return (
                    <button
                      key={`${group.kind}:${value.id}`}
                      type="button"
                      onClick={() => toggle(group.kind, value.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        selected
                          ? 'border-clay-500 bg-clay-50 text-clay-700'
                          : 'border-cream-400 bg-surface text-ink-600 hover:border-ink-500'
                      }`}
                    >
                      {value.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 border-t border-cream-200 pt-3">
            <p className="text-[11px] text-ink-500">
              {total} records in this view
              {options.sources.length > 0 ? ` · sources: ${options.sources.join(', ')}` : ''}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft({});
                  setSortDraft({ field: 'score', direction: 'desc' });
                  router.push('/internships');
                }}
              >
                Reset everything
              </Button>
              <Button variant="secondary" onClick={() => navigate(draft)}>
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Empty values are dropped so the URL stays readable and shareable. */
function pruneDraft(draft: InternshipFilter): InternshipFilter {
  const cleaned: InternshipFilter = { ...draft };
  for (const [key, value] of Object.entries(cleaned) as Array<[keyof InternshipFilter, unknown]>) {
    if (Array.isArray(value) && value.length === 0) delete cleaned[key];
    if (value === '' || value === undefined || value === null) delete cleaned[key];
  }
  return cleaned;
}

/** Maps a classification kind to the internship filter key it drives. */
function groupKindToFilterKey(kind: string): keyof InternshipFilter {
  switch (kind) {
    case 'workMode':
      return 'workMode';
    case 'internshipType':
      return 'internshipType';
    case 'region':
      return 'region';
    case 'technology':
      return 'technologies';
    case 'companyType':
      return 'companyType';
    default:
      return 'status';
  }
}
