'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, DemoBadge, MatchLevelBadge, StatusBadge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { ScorePill } from '@/components/ui/Data';
import { Checkbox, Select } from '@/components/ui/Form';
import { apiFetch, errorMessageOf } from '@/lib/client/api';
import { colorFor, labelFor } from '@/lib/domain/classify';
import { effectiveMatchLevel, effectiveScore } from '@/lib/domain/score';
import type {
  ClassificationValue,
  Internship,
  InternshipFilter,
  InternshipSort,
} from '@/lib/domain/types';
import { toSearchParams } from '@/lib/util/search-params';

/**
 * Interactive list: selection + bulk actions + batch evaluation. Everything that changes
 * data goes through the API (bulk / evaluate routes), then the router is refreshed so the
 * server rendered rows stay the single source of truth.
 */

const EVAL_CHUNK = 25;

type RowPhase = 'processing' | 'completed' | 'failed' | 'skipped';

interface EvaluateResponse {
  results: Array<{
    internshipId: string;
    status: 'completed' | 'failed' | 'skipped';
    score?: number;
    matchLevel?: string;
    fallback?: boolean;
    error?: string;
  }>;
  completed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export function InternshipTable({
  items,
  values,
  matchLevels,
  filter,
  sort,
  pageSize,
}: {
  items: Internship[];
  values: ClassificationValue[];
  matchLevels: Array<{ id: string; label: string; minScore: number }>;
  filter: InternshipFilter;
  sort: InternshipSort;
  pageSize: number;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [phases, setPhases] = useState<Record<string, RowPhase>>({});

  const statusValues = values.filter((value) => value.kind === 'status');
  const allSelected = items.length > 0 && selected.length === items.length;

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : items.map((item) => item.id));
  }

  async function bulkAction(
    key: string,
    body: { ids: string[]; action: string; status?: string },
    success: (affected: number) => string,
  ) {
    if (selected.length === 0) return;
    setBusy(key);
    try {
      const result = await apiFetch<{ affected: number }>('/api/internships/bulk', { method: 'POST', json: body });
      push({ tone: 'success', title: success(result.affected) });
      setSelected([]);
      router.refresh();
    } catch (error) {
      push({ tone: 'error', title: 'Bulk action failed', description: errorMessageOf(error) });
    } finally {
      setBusy(null);
    }
  }

  /** Evaluation runs in sequential chunks of 25 (the API limit) with live per-row state. */
  async function evaluateSelected(force = false) {
    if (selected.length === 0) return;
    setBusy('evaluate');
    const queue = [...selected];
    setPhases(Object.fromEntries(queue.map((id) => [id, 'processing' as RowPhase])));
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    try {
      while (queue.length > 0) {
        const chunk = queue.splice(0, EVAL_CHUNK);
        const response = await apiFetch<EvaluateResponse>('/api/evaluate', {
          method: 'POST',
          json: { ids: chunk, force },
        });
        completed += response.completed;
        failed += response.failed;
        skipped += response.skipped;
        setPhases((current) => ({
          ...current,
          ...Object.fromEntries(
            response.results.map((result) => [
              result.internshipId,
              result.status === 'completed' ? 'completed' : result.status === 'failed' ? 'failed' : 'skipped',
            ]),
          ),
        }));
      }
      push({
        tone: failed > 0 ? 'warning' : 'success',
        title: `Evaluation finished: ${completed} scored, ${failed} failed, ${skipped} skipped.`,
      });
      router.refresh();
    } catch (error) {
      push({ tone: 'error', title: 'Evaluation failed', description: errorMessageOf(error) });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function deleteSelected() {
    if (selected.length === 0) return;
    if (!window.confirm(`Delete ${selected.length} selected internship(s)? This cannot be undone.`)) return;
    void bulkAction('delete', { ids: selected, action: 'delete' }, (affected) => `Deleted ${affected} records.`);
  }

  const sortHref = (field: string): string => {
    const direction = sort.field === field && sort.direction === 'desc' ? 'asc' : 'desc';
    const query = toSearchParams({ filter, sort: { field: field as never, direction }, pageSize }).toString();
    return query ? `/internships?${query}` : '/internships';
  };

  const sortIndicator = (field: string): string =>
    sort.field === field ? (sort.direction === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <span className="mr-1 text-sm font-medium">{selected.length} selected</span>
          <Button variant="primary" size="sm" loading={busy === 'evaluate'} onClick={() => evaluateSelected(false)}>
            Evaluate
          </Button>
          <Button variant="secondary" size="sm" loading={busy === 're-evaluate'} onClick={() => evaluateSelected(true)}>
            Re-run evaluation
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={busy === 'shortlist'}
            onClick={() =>
              bulkAction('shortlist', { ids: selected, action: 'shortlist' }, (n) => `Shortlisted ${n} records.`)
            }
          >
            Shortlist
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={busy === 'reject'}
            onClick={() => bulkAction('reject', { ids: selected, action: 'reject' }, (n) => `Rejected ${n} records.`)}
          >
            Reject
          </Button>
          <Select
            aria-label="Set status for selection"
            placeholder="Set status…"
            value=""
            options={statusValues.map((value) => ({ value: value.id, label: value.label }))}
            onChange={(event) => {
              const status = event.target.value;
              if (!status) return;
              void bulkAction(
                'status',
                { ids: selected, action: 'status', status },
                (n) => `Set status on ${n} records.`,
              );
            }}
            className="w-44 py-1 text-xs"
          />
          <Button
            variant="ghost"
            size="sm"
            loading={busy === 'clear-evaluation'}
            onClick={() =>
              bulkAction(
                'clear-evaluation',
                { ids: selected, action: 'clear-evaluation' },
                (n) => `Cleared evaluation on ${n} records.`,
              )
            }
          >
            Clear evaluations
          </Button>
          <Button variant="danger" size="sm" loading={busy === 'delete'} onClick={deleteSelected}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-300 text-left text-[11px] uppercase tracking-wide text-ink-600">
              <th className="w-9 px-3 py-2.5">
                <Checkbox label="" checked={allSelected} onChange={toggleAll} aria-label="Select page" />
              </th>
              <th className="px-2 py-2.5">
                <Link href={sortHref('score')} className="hover:text-ink-900">
                  Score{sortIndicator('score')}
                </Link>
              </th>
              <th className="px-2 py-2.5">
                <Link href={sortHref('title')} className="hover:text-ink-900">
                  Position{sortIndicator('title')}
                </Link>
              </th>
              <th className="hidden px-2 py-2.5 md:table-cell">
                <Link href={sortHref('location')} className="hover:text-ink-900">
                  Location{sortIndicator('location')}
                </Link>
              </th>
              <th className="hidden px-2 py-2.5 lg:table-cell">Type</th>
              <th className="hidden px-2 py-2.5 xl:table-cell">Technologies</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="hidden px-2 py-2.5 sm:table-cell">
                <Link href={sortHref('deadline')} className="hover:text-ink-900">
                  Deadline{sortIndicator('deadline')}
                </Link>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {items.map((internship) => (
              <tr
                key={internship.id}
                className={`align-top transition-colors hover:bg-cream-50 ${
                  selected.includes(internship.id) ? 'bg-clay-50/50' : ''
                }`}
              >
                <td className="px-3 py-3">
                  <Checkbox
                    label=""
                    checked={selected.includes(internship.id)}
                    onChange={() => toggle(internship.id)}
                    aria-label={`Select ${internship.title}`}
                  />
                </td>
                <td className="px-2 py-3">
                  <ScorePill score={effectiveScore(internship)} />
                  {internship.manualOverride?.score !== undefined ? (
                    <p className="mt-0.5 text-[10px] text-ink-500">manual</p>
                  ) : null}
                </td>
                <td className="max-w-72 px-2 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/internships/${internship.id}`} className="font-medium hover:text-clay-600">
                      {internship.title}
                    </Link>
                    {internship.isDemo ? <DemoBadge /> : null}
                    {internship.evaluationStatus === 'failed' ? (
                      <Badge color="terracotta" title={internship.evaluationError ?? 'Evaluation failed'}>
                        eval failed
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {internship.company}
                    {internship.workMode
                      ? ` · ${labelFor(values, 'workMode', internship.workMode) ?? internship.workMode}`
                      : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <MatchLevelBadge
                      level={effectiveMatchLevel(internship)}
                      label={
                        matchLevels.find((level) => level.id === effectiveMatchLevel(internship))?.label ?? undefined
                      }
                    />
                    {internship.companyType ? (
                      <Badge color={colorFor(values, 'companyType', internship.companyType)}>
                        {labelFor(values, 'companyType', internship.companyType)}
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="hidden px-2 py-3 text-xs text-ink-600 md:table-cell">{internship.location}</td>
                <td className="hidden px-2 py-3 lg:table-cell">
                  {internship.internshipType ? (
                    <Badge color={colorFor(values, 'internshipType', internship.internshipType)}>
                      {labelFor(values, 'internshipType', internship.internshipType)}
                    </Badge>
                  ) : null}
                </td>
                <td className="hidden max-w-52 px-2 py-3 xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {internship.technologies.slice(0, 3).map((technology) => (
                      <Badge key={technology}>{technology}</Badge>
                    ))}
                    {internship.technologies.length > 3 ? (
                      <Badge color="slate">+{internship.technologies.length - 3}</Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <StatusBadge
                    status={internship.status}
                    label={labelFor(values, 'status', internship.status) ?? internship.status}
                    color={colorFor(values, 'status', internship.status)}
                  />
                  {phases[internship.id] ? (
                    <p
                      className={`mt-1 text-[10px] ${
                        phases[internship.id] === 'failed' ? 'text-clay-600' : 'text-ink-500'
                      }`}
                    >
                      {phases[internship.id]}
                    </p>
                  ) : null}
                </td>
                <td className="hidden px-2 py-3 text-xs text-ink-600 sm:table-cell">
                  {internship.deadline ?? internship.discoveredAt.slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
