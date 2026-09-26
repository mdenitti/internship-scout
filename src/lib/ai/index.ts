import type { AiSettings, ClassificationValue } from '@/lib/domain/types';
import type { EnvConfig } from '@/lib/config/env';
import { HeuristicEvaluationProvider } from './heuristic';
import { PollinationsEvaluationProvider } from './pollinations';
import type { AiEvaluationProvider } from './provider';

/**
 * Provider factory. Adding a provider means: implement `AiEvaluationProvider`, register it
 * here, and allow its id through the AI settings schema. Nothing else in the app changes.
 */

export function createEvaluationProvider(
  settings: AiSettings,
  classifications: readonly ClassificationValue[],
  env: EnvConfig,
): AiEvaluationProvider {
  if (settings.provider === 'heuristic' || env.pollinations.provider === 'heuristic') {
    return new HeuristicEvaluationProvider(classifications);
  }
  return new PollinationsEvaluationProvider(settings.model, { apiKey: env.pollinations.apiKey });
}

export function createHeuristicProvider(
  classifications: readonly ClassificationValue[] = [],
): AiEvaluationProvider {
  return new HeuristicEvaluationProvider(classifications);
}

export type { AiEvaluationProvider, EvaluationDraft, EvaluationInput, EvaluationOutcome } from './provider';
