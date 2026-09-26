import { describe, expect, it } from 'vitest';

import {
  buildEvaluation,
  computeEvaluationScore,
  effectiveMatchLevel,
  effectiveScore,
  isRejected,
  isShortlisted,
  matchLevelFor,
  recommendationFor,
} from '@/lib/domain/score';
import { makeEvaluation, makeInternship, makeProfile } from '@/test-support/factory';

const profile = makeProfile();

describe('computeEvaluationScore', () => {
  it('computes the weighted average over answered criteria', () => {
    const result = computeEvaluationScore(
      [
        { key: 'stack', score: 90 },
        { key: 'location', score: 60 },
      ],
      profile,
    );
    // (90 * 2 + 60 * 1) / 3 = 80
    expect(result.score).toBe(80);
    expect(result.matchLevel).toBe('excellent');
    expect(result.criteria).toHaveLength(2);
  });

  it('drops missing criteria instead of scoring them zero', () => {
    const result = computeEvaluationScore([{ key: 'stack', score: 90 }], profile);
    expect(result.score).toBe(90);
  });

  it('clamps out-of-range model scores', () => {
    const result = computeEvaluationScore(
      [
        { key: 'stack', score: 4000 },
        { key: 'location', score: -50 },
      ],
      profile,
    );
    expect(result.criteria.map((criterion) => criterion.score)).toEqual([100, 0]);
    // (100 * 2 + 0 * 1) / 3, rounded — a hallucinated 4000 cannot inflate the result
    expect(result.score).toBe(67);
  });
});

describe('effective score and level', () => {
  it('lets a manual override win over the AI score', () => {
    const internship = makeInternship({
      evaluation: makeEvaluation({ score: 30 }),
      manualOverride: { score: 95, at: '2026-01-01T00:00:00.000Z' },
    });
    expect(effectiveScore(internship)).toBe(95);
    expect(effectiveMatchLevel(internship)).toBe('good'); // from the stored evaluation
  });

  it('returns null when nothing has been scored', () => {
    expect(effectiveScore(makeInternship())).toBeNull();
    expect(effectiveMatchLevel(makeInternship())).toBeNull();
  });
});

describe('matchLevelFor', () => {
  it('picks the level whose threshold the score passes', () => {
    expect(matchLevelFor(85, profile.matchLevels).id).toBe('excellent');
    expect(matchLevelFor(61, profile.matchLevels).id).toBe('good');
    expect(matchLevelFor(10, profile.matchLevels).id).toBe('poor');
  });
});

describe('recommendationFor', () => {
  it('forces rejection below the minimum relevance', () => {
    expect(recommendationFor(40, profile, 'shortlist')).toBe('reject');
  });

  it('keeps the model recommendation above the floor', () => {
    expect(recommendationFor(85, profile, 'shortlist')).toBe('shortlist');
    expect(recommendationFor(65, profile, 'consider')).toBe('consider');
  });
});

describe('buildEvaluation', () => {
  it('stores the computed score, never the raw model claim', () => {
    const evaluation = buildEvaluation({
      modelCriteria: [
        { key: 'stack', score: 100, comment: 'perfect' },
        { key: 'location', score: 0 },
      ],
      reasons: ['reason'],
      concerns: ['concern'],
      recommendation: 'consider',
      summary: 'Mixed match.',
      profile,
      provider: 'pollinations',
      model: 'openai',
      now: () => new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(evaluation.score).toBe(67); // (100*2 + 0*1) / 3
    expect(evaluation.evaluatedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(evaluation.provider).toBe('pollinations');
  });
});

describe('status helpers', () => {
  it('recognises shortlisted and rejected statuses', () => {
    expect(isShortlisted(makeInternship({ status: 'shortlisted' }))).toBe(true);
    expect(isRejected(makeInternship({ status: 'rejected' }))).toBe(true);
    expect(isShortlisted(makeInternship({ status: 'new' }))).toBe(false);
  });
});
