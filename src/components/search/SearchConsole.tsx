'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { Checkbox, Field, Input, Select } from '@/components/ui/Form';
import { apiFetch, errorMessageOf } from '@/lib/client/api';
import { valuesForKind } from '@/lib/domain/classify';
import type {
  AppSettings,
  ClassificationKind,
  ClassificationValue,
  SearchResultItem,
} from '@/lib/domain/types';
import type { ProviderRunReport, SearchRunStats } from '@/lib/search/provider';
import type { ProviderStatus } from '@/lib/search/registry';

/**
 * Search → preview → import workflow.
 *
 * The server does the normalization and duplicate detection during the search, so this
 * component only renders previews and sends the raw candidates back for the final,
 * re-validated import.
 */

interface SearchRunResponse {
  items: SearchResultItem[];
  providers: ProviderRunReport[];
  stats: SearchRunStats;
}

interface ImportResponse {
  imported: Array<{ id: string; title: string; company: string; url: string }>;
  importedCount: number;
  duplicates: Array<{ title: string; company: string }>;
  skipped: Array<{ title: string; company: string; reason: string }>;
}

const EVAL_CHUNK = 25;

export function SearchConsole({
  providers,
  values,
  settings,
}: {
  providers: ProviderStatus[];
  values: ClassificationValue[];
  settings: AppSettings;
}) {
  const router = useRouter();
  const { push } = useToast();

  const [form, setForm] = useState({
    query: settings.search.defaultQuery,
    location: '',
    country: '',
    region: '',
    workMode: '',
    internshipType: '',
    companyType: '',
    technologies: '',
    limit: String(settings.search.resultsPerProvider),
  });
  const [active, setActive] = useState<string[]>(
    providers.filter((provider) => provider.available).map((provider) => provider.id),
  );
  const [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<SearchRunResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [importedIds, setImportedIds] = useState<string[]>([]);

  const fresh = useMemo(() => (result ? result.items.filter((item) => !item.duplicate) : []), [result]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleProvider(id: string) {
    setActive((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function toggleItem(key: string) {
    setSelected((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  const keyOf = (item: SearchResultItem, index: number): string => item.candidate.url || `${item.candidate.title}-${index}`;

  async function runSearch() {
    if (form.query.trim().length < 2) {
      push({ tone: 'error', title: 'Enter a search query of at least 2 characters.' });
      return;
    }
    setRunning(true);
    try {
      const response = await apiFetch<SearchRunResponse>('/api/search', {
        method: 'POST',
        json: {
          query: form.query,
          ...(form.location ? { location: form.location } : {}),
          ...(form.country ? { country: form.country } : {}),
          ...(form.region ? { region: form.region } : {}),
          ...(form.workMode ? { workMode: form.workMode } : {}),
          ...(form.internshipType ? { internshipType: form.internshipType } : {}),
          ...(form.companyType ? { companyType: form.companyType } : {}),
          ...(form.technologies.trim()
            ? { technologies: form.technologies.split(',').map((entry) => entry.trim()).filter(Boolean) }
            : {}),
          limit: Number(form.limit) || 10,
          ...(active.length > 0 ? { providers: active } : {}),
        },
      });
      setResult(response);
      const keys = response.items.map((item, index) => keyOf(item, index));
      setSelected(keys.filter((_, index) => !response.items[index].duplicate));
      push({ tone: 'success', title: `Found ${response.items.length} results (${response.stats.duplicateCount} duplicates).` });
    } catch (error) {
      push({ tone: 'error', title: 'Search failed', description: errorMessageOf(error) });
    } finally {
      setRunning(false);
    }
  }

  async function importSelected() {
    const candidates = result
      ? result.items
          .filter((item, index) => selected.includes(keyOf(item, index)))
          .map((item) => item.candidate)
      : [];
    if (candidates.length === 0) return;
    setImporting(true);
    try {
      const response = await apiFetch<ImportResponse>('/api/internships/import', {
        method: 'POST',
        json: { candidates },
      });
      setImportedIds(response.imported.map((entry) => entry.id));
      const parts = [`imported ${response.importedCount}`];
      if (response.duplicates.length > 0) parts.push(`${response.duplicates.length} duplicates skipped`);
      if (response.skipped.length > 0) parts.push(`${response.skipped.length} invalid skipped`);
      push({ tone: response.importedCount > 0 ? 'success' : 'warning', title: parts.join(' · ') });
      router.refresh();
    } catch (error) {
      push({ tone: 'error', title: 'Import failed', description: errorMessageOf(error) });
    } finally {
      setImporting(false);
    }
  }

  async function evaluateImported() {
    if (importedIds.length === 0) return;
    setEvaluating(true);
    let completed = 0;
    let failed = 0;
    try {
      const queue = [...importedIds];
      while (queue.length > 0) {
        const chunk = queue.splice(0, EVAL_CHUNK);
        const response = await apiFetch<{ completed: number; failed: number }>('/api/evaluate', {
          method: 'POST',
          json: { ids: chunk },
        });
        completed += response.completed;
        failed += response.failed;
      }
      push({
        tone: failed > 0 ? 'warning' : 'success',
        title: `Evaluated ${completed} imported internships${failed > 0 ? `, ${failed} failed` : ''}.`,
      });
      router.refresh();
    } catch (error) {
      push({ tone: 'error', title: 'Evaluation failed', description: errorMessageOf(error) });
    } finally {
      setEvaluating(false);
    }
  }

  function selectOptions(kind: ClassificationKind): Array<{ value: string; label: string }> {
    return valuesForKind(values, kind).map((value) => ({ value: value.id, label: value.label }));
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Query" className="md:col-span-2">
            <Input
              value={form.query}
              placeholder="frontend, data, embedded…"
              onChange={(event) => set('query', event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void runSearch();
              }}
            />
          </Field>
          <Field label="Location">
            <Input value={form.location} placeholder="e.g. Utrecht" onChange={(event) => set('location', event.target.value)} />
          </Field>
          <Field label="Region">
            <Select value={form.region} placeholder="Any" options={selectOptions('region')} onChange={(event) => set('region', event.target.value)} />
          </Field>
          <Field label="Work mode">
            <Select value={form.workMode} placeholder="Any" options={selectOptions('workMode')} onChange={(event) => set('workMode', event.target.value)} />
          </Field>
          <Field label="Internship type">
            <Select value={form.internshipType} placeholder="Any" options={selectOptions('internshipType')} onChange={(event) => set('internshipType', event.target.value)} />
          </Field>
          <Field label="Company type">
            <Select value={form.companyType} placeholder="Any" options={selectOptions('companyType')} onChange={(event) => set('companyType', event.target.value)} />
          </Field>
          <Field label="Technologies" hint="Comma separated">
            <Input value={form.technologies} placeholder="React, Python" onChange={(event) => set('technologies', event.target.value)} />
          </Field>
          <Field label="Results per provider">
            <Input type="number" min={1} max={50} value={form.limit} onChange={(event) => set('limit', event.target.value)} />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={!provider.available}
                title={provider.available ? provider.description : (provider.reason ?? 'Not available in this deployment')}
                onClick={() => toggleProvider(provider.id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                  active.includes(provider.id)
                    ? 'border-clay-400 bg-clay-100 text-clay-700'
                    : 'border-cream-400 text-ink-600 hover:border-ink-500'
                }`}
              >
                {provider.label}
                {!provider.available ? ' (needs key)' : ''}
              </button>
            ))}
          </div>
          <Button variant="primary" loading={running} onClick={runSearch}>
            Search
          </Button>
        </div>
      </div>

      {result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
            <Badge color="slate">{result.stats.rawCandidateCount} raw</Badge>
            <Badge color="slate">{result.stats.usableCandidateCount} usable</Badge>
            <Badge color="sand">{result.stats.duplicateCount} duplicates</Badge>
            <Badge color="slate">{result.stats.filteredOutCount} filtered out</Badge>
            <span>in {result.stats.durationMs} ms</span>
            <span className="ml-auto flex gap-1.5">
              {result.providers.map((report) => (
                <Badge key={report.provider} color={report.error ? 'terracotta' : 'sage'} title={report.error?.message}>
                  {report.label}: {report.error ? 'error' : report.candidateCount} ({report.durationMs} ms)
                </Badge>
              ))}
            </span>
          </div>

          <div className="card flex flex-wrap items-center gap-2 p-3">
            <span className="text-sm font-medium">{selected.length} of {fresh.length} new results selected</span>
            <Button variant="primary" loading={importing} disabled={selected.length === 0} onClick={importSelected}>
              Import selected
            </Button>
            {importedIds.length > 0 ? (
              <Button variant="secondary" loading={evaluating} onClick={evaluateImported}>
                Evaluate the {importedIds.length} imported
              </Button>
            ) : null}
            <Link href="/internships" className="ml-auto text-sm text-clay-600 hover:underline">
              Review all internships →
            </Link>
          </div>

          {result.items.length === 0 ? (
            <div className="card px-6 py-10 text-center text-sm text-ink-600">
              No results matched this query. Try fewer filters or another provider.
            </div>
          ) : (
            <ul className="space-y-2">
              {result.items.map((item, index) => {
                const key = keyOf(item, index);
                const duplicate = item.duplicate;
                const preview = item.preview;
                return (
                  <li
                    key={key}
                    className={`card flex items-start gap-3 p-4 ${duplicate ? 'border border-sand-500/50 bg-sand-50/40' : ''}`}
                  >
                    <Checkbox
                      label=""
                      checked={selected.includes(key)}
                      disabled={Boolean(duplicate)}
                      onChange={() => toggleItem(key)}
                      aria-label={`Select ${item.candidate.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a
                          href={item.candidate.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:text-clay-600"
                        >
                          {item.candidate.title} ↗
                        </a>
                        <Badge color="slate">{item.candidate.source}</Badge>
                        {duplicate ? (
                          <Badge color="sand" title={`Matches ${duplicate.existingTitle} — ${duplicate.existingCompany}`}>
                            duplicate ({duplicate.reason})
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-600">
                        {item.candidate.company}
                        {preview?.location ? ` · ${preview.location}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {preview?.workMode ? <Badge color="sky">{preview.workMode}</Badge> : null}
                        {preview?.internshipType ? <Badge color="sage">{preview.internshipType}</Badge> : null}
                        {preview?.companyType ? <Badge color="plum">{preview.companyType}</Badge> : null}
                        {preview?.region ? <Badge color="slate">{preview.region}</Badge> : null}
                        {(preview?.technologies ?? []).slice(0, 4).map((technology) => (
                          <Badge key={technology}>{technology}</Badge>
                        ))}
                      </div>
                      {item.candidate.description ? (
                        <p className="mt-1.5 line-clamp-2 text-xs text-ink-600">{item.candidate.description}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="card px-6 py-10 text-center text-sm text-ink-600">
          Run a search to preview results before importing them. Nothing is stored until you import.
        </div>
      )}
    </div>
  );
}
