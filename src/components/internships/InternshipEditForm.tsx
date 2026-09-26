'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox, ChipInput, Field, Input, Select, Textarea } from '@/components/ui/Form';
import { apiFetch, errorMessageOf } from '@/lib/client/api';
import { valuesForKind } from '@/lib/domain/classify';
import type { ClassificationKind, ClassificationValue, Internship } from '@/lib/domain/types';

/**
 * Inline editor for a single internship. Every editable field from `internshipPatchSchema`
 * is represented; values are sent as a partial PATCH, so leaving a field out (an empty URL)
 * keeps whatever is stored.
 */
export function InternshipEditForm({
  internship,
  values,
  onCancel,
  onSaved,
}: {
  internship: Internship;
  values: ClassificationValue[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    title: internship.title,
    company: internship.company,
    url: internship.url,
    description: internship.description,
    location: internship.location,
    country: internship.country ?? '',
    region: internship.region ?? '',
    internshipType: internship.internshipType ?? '',
    companyType: internship.companyType ?? '',
    workMode: internship.workMode ?? '',
    duration: internship.duration ?? '',
    startDate: internship.startDate ?? '',
    deadline: internship.deadline ?? '',
    compensation: internship.compensation ?? '',
    status: internship.status,
    notes: internship.notes ?? '',
    technologies: internship.technologies,
    skills: internship.skills,
    manualScore: internship.manualOverride?.score !== undefined ? String(internship.manualOverride.score) : '',
    reclassify: false,
  });

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /** Include a classification id only when it differs, so untouched fields are not rewritten. */
  function optionsFor(kind: ClassificationKind, current: string): Array<{ value: string; label: string }> {
    const base = valuesForKind(values, kind).map((value) => ({ value: value.id, label: value.label }));
    if (current && !base.some((option) => option.value === current)) {
      base.unshift({ value: current, label: `${current} (custom)` });
    }
    return base;
  }

  async function save() {
    if (draft.title.trim().length === 0 || draft.company.trim().length === 0) {
      setError('Title and company are required.');
      return;
    }
    setSaving(true);
    setError(null);

    const manualOverride =
      draft.manualScore.trim() === ''
        ? null
        : { score: Math.max(0, Math.min(100, Number(draft.manualScore))), at: new Date().toISOString() };

    const payload: Record<string, unknown> = {
      title: draft.title,
      company: draft.company,
      description: draft.description,
      location: draft.location,
      country: draft.country,
      region: draft.region,
      internshipType: draft.internshipType,
      companyType: draft.companyType,
      workMode: draft.workMode,
      duration: draft.duration,
      startDate: draft.startDate,
      deadline: draft.deadline,
      compensation: draft.compensation,
      status: draft.status,
      notes: draft.notes,
      technologies: draft.technologies,
      skills: draft.skills,
      manualOverride,
      ...(draft.url.trim() ? { url: draft.url.trim() } : {}),
      ...(draft.reclassify ? { reclassify: true } : {}),
    };

    try {
      await apiFetch(`/api/internships/${internship.id}`, { method: 'PATCH', json: payload });
      onSaved();
    } catch (caught) {
      setError(errorMessageOf(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-base font-medium">Edit internship</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title *">
          <Input value={draft.title} onChange={(event) => set('title', event.target.value)} />
        </Field>
        <Field label="Company *">
          <Input value={draft.company} onChange={(event) => set('company', event.target.value)} />
        </Field>
        <Field label="Posting URL" hint="Must be a valid http(s) URL; leave as is to keep the current one." className="sm:col-span-2">
          <Input value={draft.url} onChange={(event) => set('url', event.target.value)} />
        </Field>
        <Field label="Location">
          <Input value={draft.location} onChange={(event) => set('location', event.target.value)} />
        </Field>
        <Field label="Country">
          <Input value={draft.country} onChange={(event) => set('country', event.target.value)} />
        </Field>
        <Field label="Region">
          <Select
            value={draft.region}
            placeholder="—"
            options={optionsFor('region', draft.region)}
            onChange={(event) => set('region', event.target.value)}
          />
        </Field>
        <Field label="Work mode">
          <Select
            value={draft.workMode}
            placeholder="—"
            options={optionsFor('workMode', draft.workMode)}
            onChange={(event) => set('workMode', event.target.value)}
          />
        </Field>
        <Field label="Internship type">
          <Select
            value={draft.internshipType}
            placeholder="—"
            options={optionsFor('internshipType', draft.internshipType)}
            onChange={(event) => set('internshipType', event.target.value)}
          />
        </Field>
        <Field label="Company type">
          <Select
            value={draft.companyType}
            placeholder="—"
            options={optionsFor('companyType', draft.companyType)}
            onChange={(event) => set('companyType', event.target.value)}
          />
        </Field>
        <Field label="Duration">
          <Input value={draft.duration} placeholder="e.g. 6 months" onChange={(event) => set('duration', event.target.value)} />
        </Field>
        <Field label="Start date">
          <Input value={draft.startDate} placeholder="e.g. 2026-09-01" onChange={(event) => set('startDate', event.target.value)} />
        </Field>
        <Field label="Application deadline">
          <Input value={draft.deadline} placeholder="e.g. 2026-08-15" onChange={(event) => set('deadline', event.target.value)} />
        </Field>
        <Field label="Compensation">
          <Input value={draft.compensation} placeholder="e.g. €500/month" onChange={(event) => set('compensation', event.target.value)} />
        </Field>
        <Field label="Status">
          <Select
            value={draft.status}
            options={valuesForKind(values, 'status').map((value) => ({ value: value.id, label: value.label }))}
            onChange={(event) => set('status', event.target.value)}
          />
        </Field>
        <Field label="Manual score (0-100)" hint="Overrides the AI score. Clear the field to remove the override.">
          <Input
            type="number"
            min={0}
            max={100}
            value={draft.manualScore}
            onChange={(event) => set('manualScore', event.target.value)}
          />
        </Field>
        <Field label="Technologies" hint="Comma separated.">
          <ChipInput values={draft.technologies} onChange={(items) => set('technologies', items)} placeholder="TypeScript, React" />
        </Field>
        <Field label="Skills" hint="Comma separated.">
          <ChipInput values={draft.skills} onChange={(items) => set('skills', items)} placeholder="API design, testing" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea rows={6} value={draft.description} onChange={(event) => set('description', event.target.value)} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={draft.notes} onChange={(event) => set('notes', event.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            checked={draft.reclassify}
            onChange={(event) => set('reclassify', event.target.checked)}
            label="Re-derive region, work mode and internship type from the text after saving"
          />
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-clay-700">{error}</p> : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" loading={saving} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
