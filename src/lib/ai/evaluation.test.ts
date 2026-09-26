import { describe, expect, it } from 'vitest';

import { HeuristicEvaluationProvider } from '@/lib/ai/heuristic';
import { extractJsonObject } from '@/lib/ai/prompt';
import {
  createDefaultAiSettings,
  createDefaultClassifications,
  createDefaultProfile,
} from '@/lib/domain/defaults';
import { buildEvaluation } from '@/lib/domain/score';
import { evaluationResponseSchema } from '@/lib/domain/schema';
import { makeInternship } from '@/test-support/factory';

const validResponse = {
  criteria: [{ key: 'stack', score: 80, comment: 'Strong overlap' }],
  reasons: ['Matches the target stack'],
  concerns: ['Unpaid'],
  recommendation: 'consider',
  summary: 'A good match overall.',
};

describe('extractJsonObject', () => {
  it('parses a bare JSON object', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses fenced JSON with surrounding prose', () => {
    const text = 'Sure! Here is the evaluation:\n```json\n{"score":10}\n```\nHope that helps.';
    expect(extractJsonObject(text)).toEqual({ score: 10 });
  });

  it('returns null for unusable output', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('{"broken": ')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
  });
});

describe('evaluationResponseSchema', () => {
  it('accepts a valid model response and applies defaults', () => {
    const parsed = evaluationResponseSchema.parse(validResponse);
    expect(parsed.reasons).toEqual(['Matches the target stack']);
    expect(evaluationResponseSchema.parse({ ...validResponse, reasons: undefined }).reasons).toEqual([]);
  });

  it('rejects scores outside 0-100', () => {
    expect(
      evaluationResponseSchema.safeParse({
        ...validResponse,
        criteria: [{ key: 'stack', score: 4000 }],
      }).success,
    ).toBe(false);
  });

  it('rejects missing or invalid required fields', () => {
    expect(evaluationResponseSchema.safeParse({ ...validResponse, summary: '' }).success).toBe(false);
    expect(evaluationResponseSchema.safeParse({ ...validResponse, recommendation: 'maybe' }).success).toBe(false);
    expect(evaluationResponseSchema.safeParse({ ...validResponse, criteria: [] }).success).toBe(false);
  });
});

describe('HeuristicEvaluationProvider', () => {
  it('produces a draft that survives schema validation and scoring', async () => {
    const profile = createDefaultProfile();
    const provider = new HeuristicEvaluationProvider(createDefaultClassifications());
    const draft = await provider.evaluateInternship({
      internship: makeInternship({ description: 'TypeScript React role in Utrecht, paid €500/month.' }),
      profile,
      settings: createDefaultAiSettings(),
    });

    const validated = evaluationResponseSchema.parse({
      criteria: draft.modelCriteria,
      reasons: draft.reasons,
      concerns: draft.concerns,
      recommendation: draft.recommendation,
      summary: draft.summary,
    });
    expect(validated.criteria).toHaveLength(profile.criteria.length);

    const evaluation = buildEvaluation({
      modelCriteria: draft.modelCriteria,
      reasons: draft.reasons,
      concerns: draft.concerns,
      recommendation: draft.recommendation,
      summary: draft.summary,
      profile,
      provider: provider.id,
      model: provider.model,
      fallback: true,
    });
    expect(evaluation.score).toBeGreaterThanOrEqual(0);
    expect(evaluation.score).toBeLessThanOrEqual(100);
    expect(evaluation.fallback).toBe(true);
    expect(evaluation.summary.length).toBeGreaterThan(0);
  });
});
