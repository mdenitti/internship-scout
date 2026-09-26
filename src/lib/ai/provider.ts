import type { AiSettings, EvaluationProfile, Internship } from '@/lib/domain/types';

/**
 * AI evaluation provider abstraction.
 *
 * The evaluator receives everything it needs as plain data and returns either a validated
 * draft (per-criterion scores + prose) or throws an `AppError`. Implementing a second
 * provider (OpenAI, Ollama, Anthropic...) means implementing this interface only.
 */

export interface EvaluationInput {
  internship: Internship;
  profile: EvaluationProfile;
  settings: AiSettings;
}

export interface EvaluationDraft {
  modelCriteria: Array<{ key: string; score: number; comment?: string }>;
  reasons: string[];
  concerns: string[];
  recommendation: 'shortlist' | 'consider' | 'reject';
  summary: string;
  /** Truncated raw provider output, for debugging. */
  raw?: string;
}

export interface AiEvaluationProvider {
  /** Stable provider id, stored on the evaluation record. */
  readonly id: string;
  /** Model identifier recorded on the evaluation record. */
  readonly model: string;
  evaluateInternship(input: EvaluationInput): Promise<EvaluationDraft>;
}

export interface EvaluationOutcome {
  internshipId: string;
  status: 'completed' | 'failed';
  error?: string;
  retryable?: boolean;
}
