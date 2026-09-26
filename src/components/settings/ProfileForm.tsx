'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ChipInput, Field, Input, Textarea } from '@/components/ui/Form';
import type { AppSettings, EvaluationCriterion, MatchLevel } from '@/lib/domain/types';
import { useSave } from './use-save';

/**
 * Evaluation profile: what a good internship looks like for you. Criteria weights and match
 * levels are editable row lists; the server re-validates the whole profile before storing it.
 */
export function ProfileForm({ settings }: { settings: AppSettings }) {
  const { saving, save } = useSave();
  const profile = settings.profile;

  const [draft, setDraft] = useState({
    name: profile.name,
    description: profile.description ?? '',
    minRelevance: String(profile.minRelevance),
    targetTechnologies: profile.targetTechnologies,
    preferredLocations: profile.preferredLocations,
    preferredRegions: profile.preferredRegions,
    preferredCompanyTypes: profile.preferredCompanyTypes,
    preferredWorkModes: profile.preferredWorkModes,
    preferredInternshipTypes: profile.preferredInternshipTypes,
    boostKeywords: profile.boostKeywords,
    avoidKeywords: profile.avoidKeywords,
    criteria: profile.criteria.map((criterion) => ({ ...criterion })),
    matchLevels: profile.matchLevels.map((level) => ({ ...level })),
  });

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function updateCriterion(index: number, patch: Partial<EvaluationCriterion>) {
    set(
      'criteria',
      draft.criteria.map((criterion, position) => (position === index ? { ...criterion, ...patch } : criterion)),
    );
  }

  function updateLevel(index: number, patch: Partial<MatchLevel>) {
    set(
      'matchLevels',
      draft.matchLevels.map((level, position) => (position === index ? { ...level, ...patch } : level)),
    );
  }

  async function submit() {
    const ok = await save(
      '/api/settings',
      {
        profile: {
          name: draft.name,
          description: draft.description,
          minRelevance: Number(draft.minRelevance),
          targetTechnologies: draft.targetTechnologies,
          preferredLocations: draft.preferredLocations,
          preferredRegions: draft.preferredRegions,
          preferredCompanyTypes: draft.preferredCompanyTypes,
          preferredWorkModes: draft.preferredWorkModes,
          preferredInternshipTypes: draft.preferredInternshipTypes,
          boostKeywords: draft.boostKeywords,
          avoidKeywords: draft.avoidKeywords,
          criteria: draft.criteria,
          matchLevels: draft.matchLevels,
          updatedAt: new Date().toISOString(),
        },
      },
      'Profile saved.',
    );
    return ok;
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Basics" description="Used in prompts and shown on the dashboard." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Profile name">
            <Input value={draft.name} onChange={(event) => set('name', event.target.value)} />
          </Field>
          <Field label="Minimum relevance (0-100)" hint="Scores below this are recommended for rejection.">
            <Input
              type="number"
              min={0}
              max={100}
              value={draft.minRelevance}
              onChange={(event) => set('minRelevance', event.target.value)}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={2} value={draft.description} onChange={(event) => set('description', event.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Preferences" description="Comma separated lists the evaluator weighs against each posting." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Target technologies">
            <ChipInput values={draft.targetTechnologies} onChange={(items) => set('targetTechnologies', items)} />
          </Field>
          <Field label="Preferred locations">
            <ChipInput values={draft.preferredLocations} onChange={(items) => set('preferredLocations', items)} />
          </Field>
          <Field label="Preferred regions">
            <ChipInput values={draft.preferredRegions} onChange={(items) => set('preferredRegions', items)} />
          </Field>
          <Field label="Preferred company types">
            <ChipInput values={draft.preferredCompanyTypes} onChange={(items) => set('preferredCompanyTypes', items)} />
          </Field>
          <Field label="Preferred work modes">
            <ChipInput values={draft.preferredWorkModes} onChange={(items) => set('preferredWorkModes', items)} />
          </Field>
          <Field label="Preferred internship types">
            <ChipInput
              values={draft.preferredInternshipTypes}
              onChange={(items) => set('preferredInternshipTypes', items)}
            />
          </Field>
          <Field label="Boost keywords">
            <ChipInput values={draft.boostKeywords} onChange={(items) => set('boostKeywords', items)} />
          </Field>
          <Field label="Avoid keywords">
            <ChipInput values={draft.avoidKeywords} onChange={(items) => set('avoidKeywords', items)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Scoring criteria"
          description="Weights 0–10. Criteria the model does not answer are excluded from the average."
          action={
            <Button
              size="sm"
              variant="secondary"
              disabled={draft.criteria.length >= 12}
              onClick={() =>
                set('criteria', [
                  ...draft.criteria,
                  { key: `criterion_${draft.criteria.length + 1}`, label: 'New criterion', weight: 1 },
                ])
              }
            >
              Add criterion
            </Button>
          }
        />
        <div className="space-y-2">
          {draft.criteria.map((criterion, index) => (
            <div key={index} className="grid items-end gap-2 border-b border-cream-200 pb-2 sm:grid-cols-12">
              <Field label="Key" className="sm:col-span-3">
                <Input value={criterion.key} onChange={(event) => updateCriterion(index, { key: event.target.value })} />
              </Field>
              <Field label="Label" className="sm:col-span-4">
                <Input
                  value={criterion.label}
                  onChange={(event) => updateCriterion(index, { label: event.target.value })}
                />
              </Field>
              <Field label="Weight" className="sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={criterion.weight}
                  onChange={(event) => updateCriterion(index, { weight: Number(event.target.value) })}
                />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Input
                  value={criterion.description ?? ''}
                  onChange={(event) => updateCriterion(index, { description: event.target.value })}
                />
              </Field>
              <div className="sm:col-span-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={draft.criteria.length <= 1}
                  onClick={() => set('criteria', draft.criteria.filter((_, position) => position !== index))}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Match levels"
          description="The score threshold each level starts at."
          action={
            <Button
              size="sm"
              variant="secondary"
              disabled={draft.matchLevels.length >= 10}
              onClick={() =>
                set('matchLevels', [...draft.matchLevels, { id: `level_${draft.matchLevels.length + 1}`, label: 'New level', minScore: 50 }])
              }
            >
              Add level
            </Button>
          }
        />
        <div className="space-y-2">
          {draft.matchLevels.map((level, index) => (
            <div key={index} className="grid items-end gap-2 border-b border-cream-200 pb-2 sm:grid-cols-12">
              <Field label="Id" className="sm:col-span-3">
                <Input value={level.id} onChange={(event) => updateLevel(index, { id: event.target.value })} />
              </Field>
              <Field label="Label" className="sm:col-span-5">
                <Input value={level.label} onChange={(event) => updateLevel(index, { label: event.target.value })} />
              </Field>
              <Field label="Min score" className="sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={level.minScore}
                  onChange={(event) => updateLevel(index, { minScore: Number(event.target.value) })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={draft.matchLevels.length <= 1}
                  onClick={() => set('matchLevels', draft.matchLevels.filter((_, position) => position !== index))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" loading={saving} onClick={submit}>
          Save profile
        </Button>
      </div>
    </div>
  );
}
