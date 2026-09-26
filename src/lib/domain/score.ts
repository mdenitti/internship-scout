import { clamp } from './validate';
import type {
  CriterionScore,
  EvaluationProfile,
  Internship,
  InternshipEvaluation,
  MatchLevel,
} from './types';

/**
 * Scoring is deterministic and owned by us: the model only supplies per-criterion scores
 * and prose. This means a hallucinated "score: 100" in the model output cannot inflate a
 * record, and the weighting stays user configurable.
 */

export function matchLevelFor(score: number, levels: readonly MatchLevel[]): MatchLevel {
  const ordered = [...levels].sort((a, b) => b.minScore - a.minScore);
  const fallback: MatchLevel =
    ordered[ordered.length - 1] ?? { id: 'unknown', label: 'Unrated', minScore: 0 };
  return ordered.find((level) => score >= level.minScore) ?? fallback;
}

export interface ComputedEvaluation {
  score: number;
  matchLevel: string;
  criteria: CriterionScore[];
}

/**
 * Weighted average over the profile criteria. Criteria the model did not answer are
 * treated as missing (weight removed) so an incomplete answer lowers confidence rather
 * than silently scoring 0.
 */
export function computeEvaluationScore(
  modelCriteria: Array<{ key: string; score: number; comment?: string }>,
  profile: EvaluationProfile,
): ComputedEvaluation {
  const byKey = new Map(modelCriteria.map((criterion) => [criterion.key.trim().toLowerCase(), criterion]));
  const criteria: CriterionScore[] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  for (const criterion of profile.criteria) {
    const match = byKey.get(criterion.key.toLowerCase());
    if (!match) continue;
    const score = clamp(match.score);
    const weight = Math.max(0, criterion.weight);
    weightedSum += score * weight;
    weightTotal += weight;
    criteria.push({
      key: criterion.key,
      label: criterion.label,
      weight,
      score,
      ...(match.comment ? { comment: match.comment } : {}),
    });
  }

  const score = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
  return { score, matchLevel: matchLevelFor(score, profile.matchLevels).id, criteria };
}

/** The score the rest of the app sorts and filters on: manual override beats the AI. */
export function effectiveScore(internship: Internship): number | null {
  if (typeof internship.manualOverride?.score === 'number') return internship.manualOverride.score;
  if (internship.evaluation) return internship.evaluation.score;
  return null;
}

export function effectiveMatchLevel(internship: Internship): string | null {
  if (internship.manualOverride?.matchLevel) return internship.manualOverride.matchLevel;
  return internship.evaluation?.matchLevel ?? null;
}

export function isEvaluated(internship: Internship): boolean {
  return internship.evaluationStatus === 'completed' && internship.evaluation !== null;
}

export function isShortlisted(internship: Internship): boolean {
  return /shortlist|favorite|favourite|starred/i.test(internship.status);
}

export function isRejected(internship: Internship): boolean {
  return /reject|declin|archiv|pass/i.test(internship.status);
}

/** Build the persisted evaluation from a validated model response. */
export function buildEvaluation(input: {
  modelCriteria: Array<{ key: string; score: number; comment?: string }>;
  reasons: string[];
  concerns: string[];
  recommendation: InternshipEvaluation['recommendation'];
  summary: string;
  profile: EvaluationProfile;
  provider: string;
  model: string;
  raw?: string;
  fallback?: boolean;
  now?: () => Date;
}): InternshipEvaluation {
  const computed = computeEvaluationScore(input.modelCriteria, input.profile);
  return {
    provider: input.provider,
    model: input.model,
    profileId: input.profile.id,
    profileName: input.profile.name,
    score: computed.score,
    matchLevel: computed.matchLevel,
    criteria: computed.criteria,
    reasons: input.reasons,
    concerns: input.concerns,
    recommendation: input.recommendation,
    summary: input.summary,
    evaluatedAt: (input.now ?? (() => new Date()))().toISOString(),
    ...(input.raw ? { raw: input.raw } : {}),
    ...(input.fallback ? { fallback: true } : {}),
  };
}

/**
 * Recommendation is also derived from the score thresholds when the model is inconsistent
 * (e.g. "shortlist" with a score under the relevance floor).
 */
export function recommendationFor(
  score: number,
  profile: EvaluationProfile,
  modelRecommendation: InternshipEvaluation['recommendation'],
): InternshipEvaluation['recommendation'] {
  const level = matchLevelFor(score, profile.matchLevels);
  if (score < profile.minRelevance) return 'reject';
  if (level.minScore <= 0 || score >= level.minScore) return modelRecommendation;
  return modelRecommendation;
}

export function scoreBucketLabel(score: number | null): string {
  if (score === null) return 'Not scored';
  if (score >= 80) return '80-100';
  if (score >= 60) return '60-79';
  if (score >= 40) return '40-59';
  if (score >= 20) return '20-39';
  return '0-19';
}

export const SCORE_BUCKET_ORDER = ['80-100', '60-79', '40-59', '20-39', '0-19', 'Not scored'];
