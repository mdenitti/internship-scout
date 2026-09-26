'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Checkbox, Field, Input, Select } from '@/components/ui/Form';
import type { AppSettings } from '@/lib/domain/types';
import { useSave } from './use-save';

/**
 * Provider configuration for the evaluator. The free Pollinations endpoint needs no key; a
 * key is optional and only ever read from the environment, never stored in settings.
 */
export function AiSettingsForm({ settings }: { settings: AppSettings }) {
  const { saving, save } = useSave();
  const ai = settings.ai;

  const [draft, setDraft] = useState({
    provider: ai.provider,
    baseUrl: ai.baseUrl,
    model: ai.model,
    temperature: String(ai.temperature),
    maxTokens: String(ai.maxTokens),
    timeoutMs: String(ai.timeoutMs),
    concurrency: String(ai.concurrency),
    minDelayMs: String(ai.minDelayMs),
    allowHeuristicFallback: ai.allowHeuristicFallback,
  });

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function submit() {
    return save(
      '/api/settings',
      {
        ai: {
          provider: draft.provider,
          baseUrl: draft.baseUrl,
          model: draft.model,
          temperature: Number(draft.temperature),
          maxTokens: Number(draft.maxTokens),
          timeoutMs: Number(draft.timeoutMs),
          concurrency: Number(draft.concurrency),
          minDelayMs: Number(draft.minDelayMs),
          allowHeuristicFallback: draft.allowHeuristicFallback,
        },
      },
      'AI settings saved.',
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Evaluator provider"
          description="Pollinations.ai is free and needs no key; the heuristic provider works fully offline."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Provider">
            <Select
              value={draft.provider}
              options={[
                { value: 'pollinations', label: 'Pollinations LLM (free)' },
                { value: 'heuristic', label: 'Heuristic (offline, deterministic)' },
              ]}
              onChange={(event) => set('provider', event.target.value)}
            />
          </Field>
          <Field label="Model">
            <Input value={draft.model} onChange={(event) => set('model', event.target.value)} />
          </Field>
          <Field label="Base URL" className="sm:col-span-2">
            <Input value={draft.baseUrl} onChange={(event) => set('baseUrl', event.target.value)} />
          </Field>
          <Field label="Temperature (0-2)">
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={draft.temperature}
              onChange={(event) => set('temperature', event.target.value)}
            />
          </Field>
          <Field label="Max tokens (128-8000)">
            <Input
              type="number"
              min={128}
              max={8000}
              value={draft.maxTokens}
              onChange={(event) => set('maxTokens', event.target.value)}
            />
          </Field>
          <Field label="Timeout (ms)">
            <Input
              type="number"
              min={2000}
              max={120000}
              step={1000}
              value={draft.timeoutMs}
              onChange={(event) => set('timeoutMs', event.target.value)}
            />
          </Field>
          <Field label="Concurrency (1-4)" hint="Hard capped at 4 to respect the free tier.">
            <Input
              type="number"
              min={1}
              max={4}
              value={draft.concurrency}
              onChange={(event) => set('concurrency', event.target.value)}
            />
          </Field>
          <Field label="Min delay between calls (ms)">
            <Input
              type="number"
              min={0}
              max={60000}
              step={100}
              value={draft.minDelayMs}
              onChange={(event) => set('minDelayMs', event.target.value)}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              checked={draft.allowHeuristicFallback}
              onChange={(event) => set('allowHeuristicFallback', event.target.checked)}
              label="Fall back to the heuristic scorer when the LLM fails"
            />
          </div>
        </div>
      </Card>

      <p className="text-[11px] text-ink-500">
        Secrets such as <code>POLLINATIONS_API_KEY</code> or <code>TAVILY_API_KEY</code> are read from environment
        variables on the server and are never written to the database. Overriding them here is not possible by design.
      </p>

      <div className="flex justify-end">
        <Button variant="primary" loading={saving} onClick={submit}>
          Save AI settings
        </Button>
      </div>
    </div>
  );
}