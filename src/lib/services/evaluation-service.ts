import { envConfig } from '@/lib/config/env';
import { createEvaluationProvider, createHeuristicProvider } from '@/lib/ai';
import type { AiEvaluationProvider } from '@/lib/ai/provider';
import { buildEvaluation, recommendationFor } from '@/lib/domain/score';
import type { AppSettings, Internship } from '@/lib/domain/types';
import { Throttle, mapWithConcurrency } from '@/lib/util/concurrency';
import { AppError, errorMessage, isAppError } from '@/lib/util/errors';
import { withEvaluationSlot } from '@/lib/util/rate-limit';
import { getRepositories } from '@/lib/persistence';
import { requireInternship } from './internship-service';
import { getSettings } from './settings-service';

/**
 * Evaluation application service.
 *
 * Batch evaluation runs with a bounded concurrency (settings, hard capped at 4) and a minimum
 * delay between outbound calls, so a batch can never flood the free Pollinations tier. A
 * failing item never aborts the batch: it is stored as `failed` with the error message, the
 * internship itself is kept, and the UI offers a retry.
 */

export interface EvaluationItemResult {
  internshipId: string;
  title: string;
  company: string;
  status: 'completed' | 'failed' | 'skipped';
  score?: number;
  matchLevel?: string;
  provider?: string;
  fallback?: boolean;
  error?: string;
  retryable?: boolean;
}

export interface EvaluationBatchResult {
  results: EvaluationItemResult[];
  completed: number;
  failed: number;
  skipped: number;
  internships: Internship[];
  durationMs: number;
}

const HARD_CONCURRENCY_CAP = 4;

function resolveProvider(settings: AppSettings, classifications: Parameters<typeof createEvaluationProvider>[1]): {
  provider: AiEvaluationProvider;
  throttle: Throttle;
} {
  const env = envConfig();
  const provider = createEvaluationProvider(settings.ai, classifications, env);
  return { provider, throttle: new Throttle(Math.max(0, settings.ai.minDelayMs)) };
}

export interface EvaluateOptions {
  /** Re-evaluate even when an evaluation already exists. */
  force?: boolean;
}

export async function evaluateInternships(
  ids: readonly string[],
  options: EvaluateOptions = {},
): Promise<EvaluationBatchResult> {
  if (ids.length === 0) throw new AppError('BAD_REQUEST', 'Select at least one internship to evaluate.');

  const startedAt = Date.now();
  const { internships: repository, classifications } = await getRepositories();
  const values = await classifications.list();
  const settings = await getSettings();
  const { provider, throttle } = resolveProvider(settings, values);
  const heuristic = createHeuristicProvider(values);

  const selected = await repository.list({ ids: [...ids] });
  if (selected.length === 0) throw new AppError('NOT_FOUND', 'None of the selected internships exist any more.');

  const concurrency = Math.min(HARD_CONCURRENCY_CAP, Math.max(1, settings.ai.concurrency));
  const results = new Array<EvaluationItemResult>(selected.length);
  const persisted = new Map<string, Internship>();

  await mapWithConcurrency(selected, concurrency, async (internship, index) => {
    if (internship.evaluation !== null && !options.force) {
      results[index] = {
        internshipId: internship.id,
        title: internship.title,
        company: internship.company,
        status: 'skipped',
        score: internship.evaluation.score,
        matchLevel: internship.evaluation.matchLevel,
        error: 'Already evaluated. Use "re-evaluate" to run it again.',
      };
      return;
    }

    // Visible state while the provider works, so a concurrent visitor sees "processing".
    await repository.upsertMany([
      { ...internship, evaluationStatus: 'processing', updatedAt: new Date().toISOString() },
    ]);

    try {
      const draft = await withEvaluationSlot(() =>
        throttle.run(() =>
          provider.evaluateInternship({ internship, profile: settings.profile, settings: settings.ai }),
        ),
      );
      const evaluation = buildEvaluation({
        modelCriteria: draft.modelCriteria,
        reasons: draft.reasons,
        concerns: draft.concerns,
        recommendation: draft.recommendation,
        summary: draft.summary,
        profile: settings.profile,
        provider: provider.id,
        model: provider.model,
        ...(draft.raw ? { raw: draft.raw } : {}),
      });
      const stored: Internship = {
        ...internship,
        evaluation: {
          ...evaluation,
          recommendation: recommendationFor(evaluation.score, settings.profile, draft.recommendation),
        },
        evaluationStatus: 'completed',
        evaluationError: null,
        updatedAt: new Date().toISOString(),
      };
      await repository.upsertMany([stored]);
      persisted.set(stored.id, stored);
      results[index] = {
        internshipId: stored.id,
        title: stored.title,
        company: stored.company,
        status: 'completed',
        score: stored.evaluation?.score,
        matchLevel: stored.evaluation?.matchLevel,
        provider: provider.id,
      };
    } catch (error) {
      await handleFailure({ repository, heuristic, internship, error, settings, index, results, persisted });
    }
  });

  const finalResults = results.filter(Boolean);
  return {
    results: finalResults,
    completed: finalResults.filter((result) => result.status === 'completed').length,
    failed: finalResults.filter((result) => result.status === 'failed').length,
    skipped: finalResults.filter((result) => result.status === 'skipped').length,
    internships: [...persisted.values()],
    durationMs: Date.now() - startedAt,
  };
}

interface FailureContext {
  repository: Awaited<ReturnType<typeof getRepositories>>['internships'];
  heuristic: AiEvaluationProvider;
  internship: Internship;
  error: unknown;
  settings: AppSettings;
  index: number;
  results: EvaluationItemResult[];
  persisted: Map<string, Internship>;
}

/**
 * A failed evaluation must never lose the internship. We store the failure, and if the user
 * enabled the offline fallback we still produce a usable (clearly flagged) score.
 */
async function handleFailure(context: FailureContext): Promise<void> {
  const { repository, heuristic, internship, error, settings, index, results, persisted } = context;
  const appError = isAppError(error) ? error : null;
  const message = errorMessage(error);

  if (settings.ai.allowHeuristicFallback) {
    try {
      const draft = await heuristic.evaluateInternship({
        internship,
        profile: settings.profile,
        settings: settings.ai,
      });
      const evaluation = buildEvaluation({
        modelCriteria: draft.modelCriteria,
        reasons: draft.reasons,
        concerns: draft.concerns,
        recommendation: draft.recommendation,
        summary: draft.summary,
        profile: settings.profile,
        provider: heuristic.id,
        model: heuristic.model,
        ...(draft.raw ? { raw: draft.raw } : {}),
        fallback: true,
      });
      const stored: Internship = {
        ...internship,
        evaluation: {
          ...evaluation,
          recommendation: recommendationFor(evaluation.score, settings.profile, draft.recommendation),
        },
        evaluationStatus: 'completed',
        evaluationError: `AI provider failed (${message}); scored with the offline fallback.`,
        updatedAt: new Date().toISOString(),
      };
      await repository.upsertMany([stored]);
      persisted.set(stored.id, stored);
      results[index] = {
        internshipId: stored.id,
        title: stored.title,
        company: stored.company,
        status: 'completed',
        score: stored.evaluation?.score,
        matchLevel: stored.evaluation?.matchLevel,
        provider: heuristic.id,
        fallback: true,
        error: message,
      };
      return;
    } catch {
      /* fall through to the plain failure branch */
    }
  }

  const stored: Internship = {
    ...internship,
    evaluationStatus: 'failed',
    evaluationError: message,
    updatedAt: new Date().toISOString(),
  };
  await repository.upsertMany([stored]);
  persisted.set(stored.id, stored);
  results[index] = {
    internshipId: stored.id,
    title: stored.title,
    company: stored.company,
    status: 'failed',
    error: message,
    retryable: appError?.retryable ?? true,
  };
}

export async function evaluateInternship(
  id: string,
  options: EvaluateOptions = {},
): Promise<EvaluationBatchResult> {
  await requireInternship(id);
  return evaluateInternships([id], options);
}

/** The provider that would be used right now, for the settings screen. */
export async function describeActiveProvider(): Promise<{ provider: string; model: string; online: boolean }> {
  const { classifications } = await getRepositories();
  const values = await classifications.list();
  const settings = await getSettings();
  const { provider } = resolveProvider(settings, values);
  return { provider: provider.id, model: provider.model, online: provider.id !== 'heuristic' };
}
