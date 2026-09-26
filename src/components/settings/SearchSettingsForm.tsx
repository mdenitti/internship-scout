'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Checkbox, ChipInput, Field, Input } from '@/components/ui/Form';
import type { AppSettings } from '@/lib/domain/types';
import type { ProviderStatus } from '@/lib/search/registry';
import { useSave } from './use-save';

/**
 * Discovery settings: which providers run, how many results they may return and which
 * keywords make a posting an internship (used to filter generic job board noise).
 */
export function SearchSettingsForm({
  settings,
  providers,
}: {
  settings: AppSettings;
  providers: ProviderStatus[];
}) {
  const { saving, save } = useSave();
  const search = settings.search;

  const [draft, setDraft] = useState({
    enabledProviders: search.enabledProviders,
    defaultQuery: search.defaultQuery,
    resultsPerProvider: String(search.resultsPerProvider),
    timeoutMs: String(search.timeoutMs),
    contact: search.contact,
    internshipKeywords: search.internshipKeywords,
    requireInternshipKeyword: search.requireInternshipKeyword,
  });

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function toggleProvider(id: string) {
    set(
      'enabledProviders',
      draft.enabledProviders.includes(id)
        ? draft.enabledProviders.filter((entry) => entry !== id)
        : [...draft.enabledProviders, id],
    );
  }

  function submit() {
    return save(
      '/api/settings',
      {
        search: {
          enabledProviders: draft.enabledProviders,
          defaultQuery: draft.defaultQuery,
          resultsPerProvider: Number(draft.resultsPerProvider),
          timeoutMs: Number(draft.timeoutMs),
          contact: draft.contact,
          internshipKeywords: draft.internshipKeywords,
          requireInternshipKeyword: draft.requireInternshipKeyword,
        },
      },
      'Search settings saved.',
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Providers"
          description="Enabled providers run in the order shown. Unavailable ones need an API key in the environment."
        />
        <ul className="space-y-2">
          {providers.map((provider) => (
            <li key={provider.id} className="flex items-start gap-3 border-b border-cream-200 pb-2 last:border-none">
              <Checkbox
                checked={draft.enabledProviders.includes(provider.id)}
                disabled={!provider.available}
                onChange={() => toggleProvider(provider.id)}
                label={provider.label}
              />
              <div className="min-w-0 flex-1 text-xs text-ink-600">
                <p>{provider.description}</p>
                {!provider.available ? (
                  <p className="mt-0.5 text-clay-600">{provider.reason ?? 'Unavailable in this deployment.'}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Defaults & filtering" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default query" className="sm:col-span-2">
            <Input value={draft.defaultQuery} onChange={(event) => set('defaultQuery', event.target.value)} />
          </Field>
          <Field label="Results per provider (1-50)">
            <Input
              type="number"
              min={1}
              max={50}
              value={draft.resultsPerProvider}
              onChange={(event) => set('resultsPerProvider', event.target.value)}
            />
          </Field>
          <Field label="Provider timeout (ms)">
            <Input
              type="number"
              min={2000}
              max={60000}
              step={1000}
              value={draft.timeoutMs}
              onChange={(event) => set('timeoutMs', event.target.value)}
            />
          </Field>
          <Field label="Contact / referrer" hint="Sent to providers that ask for one. Not a secret." className="sm:col-span-2">
            <Input value={draft.contact} onChange={(event) => set('contact', event.target.value)} />
          </Field>
          <Field label="Internship keywords" hint="Comma separated; used to drop unrelated jobs." className="sm:col-span-2">
            <ChipInput values={draft.internshipKeywords} onChange={(items) => set('internshipKeywords', items)} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              checked={draft.requireInternshipKeyword}
              onChange={(event) => set('requireInternshipKeyword', event.target.checked)}
              label="Require at least one internship keyword (except from providers that classify a type). Turn OFF for broad discovery: collect all software jobs, because a hiring company is usually also open to interns."
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" loading={saving} onClick={submit}>
          Save search settings
        </Button>
      </div>
    </div>
  );
}