'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { InternshipEditForm } from '@/components/internships/InternshipEditForm';
import { Badge, Card, CardHeader, DemoBadge, MatchLevelBadge, StatusBadge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { ScoreMeter, ScorePill } from '@/components/ui/Data';
import { apiFetch, errorMessageOf } from '@/lib/client/api';
import { colorFor, labelFor, rejectedStatusId } from '@/lib/domain/classify';
import { effectiveMatchLevel, effectiveScore } from '@/lib/domain/score';
import type { AppSettings, ClassificationValue, Internship } from '@/lib/domain/types';

/**
 * Detail view with every mutation the workflow needs: edit, evaluate (LLM or forced re-run),
 * status changes, manual score override (inside the form) and delete. All of them PATCH the
 * API and then refresh the server rendered page.
 */
export function InternshipDetail({
  internship,
  values,
  settings,
}: {
  internship: Internship;
  values: ClassificationValue[];
  settings: AppSettings;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const score = effectiveScore(internship);
  const matchLevel = effectiveMatchLevel(internship);
  const evaluation = internship.evaluation;
  const statusValues = values.filter((value) => value.kind === 'status');

  async function run(key: string, action: () => Promise<string>): Promise<boolean> {
    setBusy(key);
    try {
      const message = await action();
      push({ tone: 'success', title: message });
      router.refresh();
      return true;
    } catch (error) {
      push({ tone: 'error', title: 'Action failed', description: errorMessageOf(error) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  function evaluate(force: boolean) {
    return run(force ? 're-evaluate' : 'evaluate', async () => {
      const result = await apiFetch<{
        completed: number;
        failed: number;
        results: Array<{ internshipId: string; status: string; score?: number }>;
      }>('/api/evaluate', {
        method: 'POST',
        json: { ids: [internship.id], force },
      });
      if (result.failed > 0) throw new Error('The evaluator reported a failure — see the evaluation panel.');
      const scored = result.results.find((entry) => entry.status === 'completed');
      return `Evaluated: ${scored?.score !== undefined ? `score ${scored.score}` : 'no score returned'}.`;
    });
  }

  function setStatus(status: string) {
    return run('status', async () => {
      await apiFetch('/api/internships/bulk', {
        method: 'POST',
        json: { ids: [internship.id], action: 'status', status },
      });
      return `Status set to “${labelFor(values, 'status', status) ?? status}”.`;
    });
  }

  async function remove() {
    if (!window.confirm('Delete this internship? This cannot be undone.')) return;
    const deleted = await run('delete', async () => {
      await apiFetch(`/api/internships/${internship.id}`, { method: 'DELETE' });
      return 'Internship deleted.';
    });
    if (deleted) router.push('/internships');
  }

  const isShortlisted = /shortlist|favorite|favourite|starred/i.test(internship.status);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl">{internship.title}</h1>
            {internship.isDemo ? <DemoBadge /> : null}
          </div>
          <p className="mt-1 text-sm text-ink-600">
            {internship.company}
            {internship.location ? ` · ${internship.location}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge
              status={internship.status}
              label={labelFor(values, 'status', internship.status) ?? internship.status}
              color={colorFor(values, 'status', internship.status)}
            />
            <MatchLevelBadge
              level={matchLevel}
              label={settings.profile.matchLevels.find((level) => level.id === matchLevel)?.label}
            />
            <ScorePill score={score} />
            {internship.evaluationStatus === 'failed' ? (
              <Badge color="terracotta" title={internship.evaluationError ?? undefined}>
                evaluation failed
              </Badge>
            ) : null}
            {internship.evaluation?.fallback ? <Badge color="sand">fallback score</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={busy === 'evaluate'} onClick={() => evaluate(false)}>
            Evaluate with AI
          </Button>
          <Button
            variant="secondary"
            loading={busy === 're-evaluate'}
            disabled={evaluation === null}
            onClick={() => evaluate(true)}
          >
            Re-run
          </Button>
          <Button variant={editing ? 'ghost' : 'secondary'} onClick={() => setEditing((value) => !value)}>
            {editing ? 'Close editor' : 'Edit'}
          </Button>
          <Button variant="danger" loading={busy === 'delete'} onClick={remove}>
            Delete
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={isShortlisted ? 'primary' : 'secondary'}
          size="sm"
          loading={busy === 'shortlist'}
          onClick={() =>
            run('shortlist', async () => {
              await apiFetch('/api/internships/bulk', {
                method: 'POST',
                json: { ids: [internship.id], action: isShortlisted ? 'reset-status' : 'shortlist' },
              });
              return isShortlisted ? 'Removed from shortlist.' : 'Shortlisted.';
            })
          }
        >
          {isShortlisted ? 'Shortlisted ✓' : 'Shortlist'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setStatus(rejectedStatusId(values))}>
          Mark rejected
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-600">Status</span>
          <select
            className="field-input w-44 py-1 text-xs"
            value=""
            onChange={(event) => {
              if (event.target.value) void setStatus(event.target.value);
            }}
          >
            <option value="">Change…</option>
            {statusValues.map((value) => (
              <option key={value.id} value={value.id}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <a
          href={internship.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[10px] border border-cream-400 px-2.5 py-1 text-xs hover:border-ink-500"
        >
          Open posting ↗
        </a>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {editing ? (
            <InternshipEditForm
              internship={internship}
              values={values}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                push({ tone: 'success', title: 'Changes saved.' });
                router.refresh();
              }}
            />
          ) : (
            <Card>
              <CardHeader title="Description" />
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                {internship.description || 'No description was provided by the source.'}
              </p>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Evaluation"
              description={
                evaluation
                  ? `${evaluation.profileName} · ${evaluation.provider}${evaluation.model ? ` (${evaluation.model})` : ''} · ${evaluation.evaluatedAt.slice(0, 16).replace('T', ' ')}`
                  : 'Not evaluated yet.'
              }
              action={<ScorePill score={score} />}
            />

            {internship.evaluationStatus === 'failed' ? (
              <div className="rounded-[10px] border border-clay-400/40 bg-clay-50 px-3 py-2 text-xs text-clay-700">
                Evaluation failed: {internship.evaluationError ?? 'unknown error.'}{' '}
                <button type="button" className="underline" onClick={() => evaluate(false)}>
                  Retry
                </button>
              </div>
            ) : null}

            {evaluation ? (
              <div className="space-y-4">
                <p className="text-sm text-ink-700">{evaluation.summary}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {evaluation.criteria.map((criterion) => (
                    <ScoreMeter key={criterion.key} score={criterion.score} label={`${criterion.label} (w${criterion.weight})`} />
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-600">Reasons</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-700">
                      {evaluation.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-600">Concerns</h3>
                    {evaluation.concerns.length === 0 ? (
                      <p className="mt-1 text-sm text-ink-500">None reported.</p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-700">
                        {evaluation.concerns.map((concern) => (
                          <li key={concern}>{concern}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
                  <Badge color="slate">recommendation: {evaluation.recommendation}</Badge>
                  <Badge color="slate">minimum relevance: {settings.profile.minRelevance}</Badge>
                  {evaluation.raw ? (
                    <details>
                      <summary className="cursor-pointer text-ink-500">raw model output</summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-cream-200 p-3 text-[11px]">
                        {evaluation.raw}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-600">
                Run the evaluator to score this posting against your profile with the configured provider.
              </p>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Facts" />
            <dl className="space-y-2 text-sm">
              {(
                [
                  ['Location', internship.location],
                  ['Region', labelFor(values, 'region', internship.region)],
                  ['Country', internship.country],
                  ['Work mode', labelFor(values, 'workMode', internship.workMode)],
                  ['Internship type', labelFor(values, 'internshipType', internship.internshipType)],
                  ['Company type', labelFor(values, 'companyType', internship.companyType)],
                  ['Duration', internship.duration],
                  ['Start date', internship.startDate],
                  ['Deadline', internship.deadline],
                  ['Compensation', internship.compensation],
                  ['Source', internship.source],
                  ['Discovered', internship.discoveredAt.slice(0, 10)],
                  ['Updated', internship.updatedAt.slice(0, 10)],
                ] as Array<[string, string | null | undefined]>
              )
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-xs text-ink-500">{label}</dt>
                    <dd className="text-right text-ink-800">{value}</dd>
                  </div>
                ))}
            </dl>

            {internship.technologies.length > 0 || internship.skills.length > 0 ? (
              <div className="mt-4 space-y-2">
                {internship.technologies.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-600">Technologies</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {internship.technologies.map((technology) => (
                        <Badge key={technology}>{technology}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {internship.skills.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-600">Skills</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {internship.skills.map((skill) => (
                        <Badge key={skill}>{skill}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Notes" description="Your own remarks, kept separate from the source text." />
            <p className="whitespace-pre-wrap text-sm text-ink-700">
              {internship.notes?.trim() || 'No notes yet. Add them with the editor.'}
            </p>
            {internship.manualOverride?.score !== undefined ? (
              <p className="mt-3 rounded-[10px] bg-sand-100 px-3 py-2 text-xs text-sand-700">
                Manual score {internship.manualOverride.score} overrides the AI result
                {internship.manualOverride.note ? ` — “${internship.manualOverride.note}”` : ''}.
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
