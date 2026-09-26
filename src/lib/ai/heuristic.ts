import { matchValue, matchValues } from '@/lib/domain/classify';
import { clamp } from '@/lib/domain/validate';
import type { ClassificationValue, EvaluationProfile, Internship } from '@/lib/domain/types';
import type { AiEvaluationProvider, EvaluationDraft, EvaluationInput } from './provider';

/**
 * Deterministic, offline evaluator.
 *
 * It exists for three reasons: unit tests must not hit the network, the app must stay usable
 * when Pollinations is unreachable, and a user may explicitly choose `AI_PROVIDER=heuristic`.
 * Evaluations it produces are flagged `fallback: true` so they are never mistaken for LLM results.
 */

function includesTerm(haystack: string, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle.length < 2) return false;
  return haystack.includes(needle);
}

export class HeuristicEvaluationProvider implements AiEvaluationProvider {
  readonly id = 'heuristic';
  readonly model = 'keyword-overlap-v1';

  constructor(private readonly classifications: readonly ClassificationValue[] = []) {}

  async evaluateInternship(input: EvaluationInput): Promise<EvaluationDraft> {
    const { internship, profile } = input;
    const haystack = [
      internship.title,
      internship.company,
      internship.description,
      internship.location,
      internship.technologies.join(' '),
      internship.skills.join(' '),
      internship.compensation ?? '',
      internship.rawText ?? '',
    ]
      .join('\n')
      .toLowerCase();

    const criteria = profile.criteria.map((criterion) => {
      switch (criterion.key) {
        case 'technology':
          return { key: criterion.key, score: this.scoreTechnology(internship, profile, haystack) };
        case 'location':
          return { key: criterion.key, score: this.scoreLocation(internship, profile, haystack) };
        case 'company':
          return { key: criterion.key, score: this.scoreCompany(internship, profile, haystack) };
        default:
          return { key: criterion.key, score: this.scoreQuality(internship, profile, haystack) };
      }
    });

    const score = weightedScore(criteria, profile);
    const reasons = buildReasons(internship, profile, haystack, score);
    const concerns = buildConcerns(internship, profile, haystack, score);
    const recommendation: EvaluationDraft['recommendation'] =
      score < profile.minRelevance ? 'reject' : score >= 70 ? 'shortlist' : 'consider';

    return {
      modelCriteria: criteria,
      reasons,
      concerns,
      recommendation,
      summary: `Deterministic keyword score ${score}/100 (${reasons.length} positive signals, ${concerns.length} concerns).`,
      raw: JSON.stringify({ provider: this.id, criteria, score }),
    };
  }

  private scoreTechnology(internship: Internship, profile: EvaluationProfile, haystack: string): number {
    const targets = profile.targetTechnologies;
    if (targets.length === 0) return 50;
    const matched = targets.filter((target) => {
      const configured = matchValues(this.classifications, 'technology', target, 1);
      const terms = [target, ...(configured[0]?.aliases ?? [])];
      return (
        internship.technologies.some((tech) => terms.some((term) => includesTerm(tech, term))) ||
        terms.some((term) => includesTerm(haystack, term))
      );
    });
    const ratio = matched.length / Math.min(targets.length, 6);
    return clamp(Math.round(Math.min(1, ratio) * 100));
  }

  private scoreLocation(internship: Internship, profile: EvaluationProfile, haystack: string): number {
    if (profile.preferredLocations.length === 0 && profile.preferredRegions.length === 0) return 50;
    const region = internship.region ? [internship.region] : [];
    const inPreferredLocation = profile.preferredLocations.some((location) =>
      includesTerm(`${internship.location}\n${haystack.slice(0, 400)}`, location),
    );
    const inPreferredRegion = profile.preferredRegions.some((preferred) =>
      region.some((value) => includesTerm(value, preferred)),
    );
    if (inPreferredLocation && inPreferredRegion) return 100;
    if (inPreferredLocation) return 85;
    if (inPreferredRegion) return 70;
    if (internship.workMode === 'remote') return 60;
    return 25;
  }

  private scoreCompany(internship: Internship, profile: EvaluationProfile, haystack: string): number {
    if (profile.preferredCompanyTypes.length === 0) return 50;
    const configured = internship.companyType
      ? matchValue(this.classifications, 'companyType', internship.companyType)
      : null;
    const candidates = [internship.companyType ?? '', configured?.label ?? '', configured?.id ?? ''];
    const hit = profile.preferredCompanyTypes.some(
      (preferred) =>
        candidates.some((candidate) => includesTerm(candidate, preferred)) ||
        includesTerm(haystack.slice(0, 600), preferred),
    );
    if (hit) return 88;
    if (profile.preferredWorkModes.length > 0 && internship.workMode === 'remote') return 60;
    return 45;
  }

  private scoreQuality(internship: Internship, profile: EvaluationProfile, haystack: string): number {
    let score = 45;
    const boosts = profile.boostKeywords.filter((keyword) => includesTerm(haystack, keyword)).length;
    const avoids = profile.avoidKeywords.filter((keyword) => includesTerm(haystack, keyword)).length;
    score += Math.min(30, boosts * 8);
    score -= Math.min(45, avoids * 15);
    if (internship.description.length > 400) score += 8;
    if (internship.description.length > 1200) score += 5;
    if (internship.compensation) score += 8;
    if (internship.duration) score += 3;
    if (internship.technologies.length >= 4) score += 6;
    return clamp(Math.round(score));
  }
}

function weightedScore(
  criteria: Array<{ key: string; score: number }>,
  profile: EvaluationProfile,
): number {
  let sum = 0;
  let weight = 0;
  for (const criterion of criteria) {
    const configured = profile.criteria.find((entry) => entry.key === criterion.key);
    const criterionWeight = configured?.weight ?? 1;
    sum += criterion.score * criterionWeight;
    weight += criterionWeight;
  }
  return weight > 0 ? Math.round(sum / weight) : 0;
}

function buildReasons(
  internship: Internship,
  profile: EvaluationProfile,
  haystack: string,
  score: number,
): string[] {
  const reasons: string[] = [];
  const matched = profile.targetTechnologies.filter((target) => includesTerm(haystack, target));
  if (matched.length > 0) reasons.push(`Relevant technologies detected: ${matched.slice(0, 5).join(', ')}.`);
  if (
    internship.region &&
    profile.preferredRegions.some((region) => includesTerm(internship.region as string, region))
  ) {
    reasons.push(`Located in a preferred region (${internship.region}).`);
  } else if (internship.location) {
    reasons.push(`Located in ${internship.location}.`);
  }
  if (internship.workMode && profile.preferredWorkModes.includes(internship.workMode)) {
    reasons.push(`Work mode "${internship.workMode}" matches the profile.`);
  }
  if (internship.compensation) reasons.push(`Compensation mentioned: ${internship.compensation}.`);
  if (reasons.length === 0) {
    reasons.push(`Heuristic baseline score ${score}/100 with no strong signals detected.`);
  }
  return reasons.slice(0, 4);
}

function buildConcerns(
  internship: Internship,
  profile: EvaluationProfile,
  haystack: string,
  score: number,
): string[] {
  const concerns: string[] = [];
  if (internship.description.length < 200) concerns.push('Very little description text to judge the role on.');
  const avoided = profile.avoidKeywords.filter((keyword) => includesTerm(haystack, keyword));
  if (avoided.length > 0) concerns.push(`Contains discouraged keywords: ${avoided.join(', ')}.`);
  if (!internship.compensation) concerns.push('No compensation information found.');
  if (internship.deadline && Date.parse(internship.deadline) < Date.now()) {
    concerns.push('The application deadline appears to have passed.');
  }
  if (score < profile.minRelevance) concerns.push('Below the configured minimum relevance.');
  return concerns.slice(0, 4);
}

