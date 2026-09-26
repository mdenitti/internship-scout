'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ChipInput, Field, Input, Select } from '@/components/ui/Form';
import { apiFetch, errorMessageOf } from '@/lib/client/api';
import { CLASSIFICATION_KINDS, type ClassificationValue } from '@/lib/domain/types';
import { useSave } from './use-save';

const KIND_LABELS: Record<string, string> = {
  companyType: 'Company types',
  location: 'Locations',
  region: 'Regions',
  country: 'Countries',
  workMode: 'Work modes',
  internshipType: 'Internship types',
  technology: 'Technologies',
  status: 'Statuses',
};

const COLORS = ['terracotta', 'sage', 'sky', 'sand', 'plum', 'slate'];

/**
 * Editor for the classification registry. The registry is saved as a whole (the API validates
 * and de-duplicates ids), and usage counts are fetched so deleting a value in use can warn.
 */
export function ClassificationsEditor({ values }: { values: ClassificationValue[] }) {
  const { saving, save } = useSave();
  const [draft, setDraft] = useState<ClassificationValue[]>(() => values.map((value) => ({ ...value, aliases: [...value.aliases] })));
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ usage: Record<string, number> }>('/api/classifications')
      .then((response) => {
        if (!cancelled) setUsage(response.usage ?? {});
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const usageKey = (value: ClassificationValue): string => value.id;

  function update(index: number, patch: Partial<ClassificationValue>) {
    setDraft((current) => current.map((value, position) => (position === index ? { ...value, ...patch } : value)));
  }

  function addValue(kind: string) {
    let suffix = draft.filter((value) => value.kind === kind).length + 1;
    let id = `new-value-${suffix}`;
    while (draft.some((value) => value.kind === kind && value.id === id)) {
      suffix += 1;
      id = `new-value-${suffix}`;
    }
    setDraft((current) => [
      ...current,
      { id, kind: kind as ClassificationValue['kind'], label: 'New value', aliases: [], color: 'slate' },
    ]);
  }

  function removeValue(index: number) {
    const target = draft[index];
    if (!target) return;
    const used = usage[usageKey(target)] ?? 0;
    if (used > 0 && !window.confirm(`"${target.label}" is used by ${used} internship(s). Remove it anyway? Those references will be pruned.`)) {
      return;
    }
    setDraft((current) => current.filter((_, position) => position !== index));
  }

  async function submit() {
    await save('/api/classifications', { values: draft }, 'Classifications saved.', 'PUT');
  }

  async function reset() {
    if (!window.confirm('Restore the default classification values? Your additions will be lost.')) return;
    setBusy('reset');
    try {
      await apiFetch('/api/classifications', { method: 'DELETE' });
      const response = await apiFetch<{ values: ClassificationValue[] }>('/api/classifications');
      setDraft(response.values.map((value) => ({ ...value, aliases: [...value.aliases] })));
      setUsage({});
    } catch (error) {
      window.alert(`Reset failed: ${errorMessageOf(error)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-600">
          Values are referenced by id when a record is normalized or filtered. Editing a label
          updates the UI everywhere; deleting a value prunes it from stored internships.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" loading={busy === 'reset'} onClick={reset}>
            Reset to defaults
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            Save registry
          </Button>
        </div>
      </div>

      {CLASSIFICATION_KINDS.map((kind) => {
        const entries = draft
          .map((value, index) => ({ value, index }))
          .filter((entry) => entry.value.kind === kind);

        return (
          <Card key={kind}>
            <CardHeader
              title={KIND_LABELS[kind] ?? kind}
              description={`${entries.length} value${entries.length === 1 ? '' : 's'}`}
              action={
                <Button size="sm" variant="secondary" onClick={() => addValue(kind)}>
                  Add value
                </Button>
              }
            />

            {entries.length === 0 ? (
              <p className="text-sm text-ink-500">No values yet.</p>
            ) : (
              <ul className="space-y-3">
                {entries.map(({ value, index }) => {
                  const used = usage[value.id] ?? 0;
                  return (
                    <li key={value.id} className="grid items-end gap-2 border-b border-cream-200 pb-3 sm:grid-cols-12">
                      <Field label="Id" className="sm:col-span-3" hint={used > 0 ? `used by ${used}` : undefined}>
                        <Input value={value.id} readOnly title="Ids are fixed; add a new value instead." onChange={() => undefined} />
                      </Field>
                      <Field label="Label" className="sm:col-span-3">
                        <Input value={value.label} onChange={(event) => update(index, { label: event.target.value })} />
                      </Field>
                      <Field label="Aliases" hint="Comma separated" className="sm:col-span-3">
                        <ChipInput values={value.aliases} onChange={(items) => update(index, { aliases: items })} />
                      </Field>
                      <Field label="Color" className="sm:col-span-2">
                        <Select
                          value={value.color ?? 'slate'}
                          options={COLORS.map((color) => ({ value: color, label: color }))}
                          onChange={(event) => update(index, { color: event.target.value as ClassificationValue['color'] })}
                        />
                      </Field>
                      <div className="sm:col-span-1">
                        <Button size="sm" variant="ghost" onClick={() => removeValue(index)}>
                          ✕
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}