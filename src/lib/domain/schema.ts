import { z } from 'zod';

import { CLASSIFICATION_KINDS } from './types';
import { isSafeExternalUrl } from '@/lib/util/url';
import { isoTimestamp } from './validate';

const trimmed = (max = 400) => z.string().trim().max(max);

const scoreValue = z.number().min(0).max(100);

export const classificationKindSchema = z.enum(CLASSIFICATION_KINDS);

export const classificationColorSchema = z.enum(['terracotta', 'sage', 'sky', 'sand', 'plum', 'slate']);

export const classificationValueSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, digits and dashes'),
  kind: classificationKindSchema,
  label: trimmed(80).min(1),
  description: trimmed(400).optional(),
  aliases: z.array(trimmed(80)).max(30).default([]),
  color: classificationColorSchema.optional(),
  builtin: z.boolean().optional(),
  order: z.number().int().optional(),
});

export const classificationsSchema = z.object({
  values: z.array(classificationValueSchema).max(1000),
});

export const evaluationCriterionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lowercase letters, digits, dashes or underscores'),
  label: trimmed(60).min(1),
  weight: z.number().min(0).max(10),
  description: trimmed(400).optional(),
});

export const matchLevelSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: trimmed(60).min(1),
  minScore: scoreValue,
});

export const evaluationProfileSchema = z
  .object({
    id: z.string().trim().min(1).max(60),
    name: trimmed(80).min(1),
    description: trimmed(400).optional(),
    targetTechnologies: z.array(trimmed(60)).max(60).default([]),
    preferredLocations: z.array(trimmed(60)).max(60).default([]),
    preferredRegions: z.array(trimmed(60)).max(60).default([]),
    preferredCompanyTypes: z.array(trimmed(60)).max(60).default([]),
    preferredWorkModes: z.array(trimmed(60)).max(60).default([]),
    preferredInternshipTypes: z.array(trimmed(60)).max(60).default([]),
    boostKeywords: z.array(trimmed(60)).max(60).default([]),
    avoidKeywords: z.array(trimmed(60)).max(60).default([]),
    minRelevance: scoreValue.default(50),
    criteria: z.array(evaluationCriterionSchema).min(1).max(12),
    matchLevels: z.array(matchLevelSchema).min(1).max(10),
    updatedAt: isoTimestamp,
  })
  .strict();

export const aiSettingsSchema = z
  .object({
    provider: z.enum(['pollinations', 'heuristic']),
    baseUrl: z.string().trim().url().max(300),
    model: trimmed(120).min(1),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().min(128).max(8000),
    timeoutMs: z.number().int().min(2000).max(120000),
    concurrency: z.number().int().min(1).max(4),
    minDelayMs: z.number().int().min(0).max(60000),
    allowHeuristicFallback: z.boolean(),
  })
  .strict();

export const searchSettingsSchema = z
  .object({
    enabledProviders: z.array(trimmed(60)).max(20),
    defaultQuery: trimmed(200),
    resultsPerProvider: z.number().int().min(1).max(50),
    timeoutMs: z.number().int().min(2000).max(60000),
    contact: trimmed(200),
    internshipKeywords: z.array(trimmed(40)).max(40),
    requireInternshipKeyword: z.boolean(),
  })
  .strict();

export const generalSettingsSchema = z
  .object({
    autoSeedDemo: z.boolean(),
  })
  .strict();

export const appSettingsSchema = z
  .object({
    profile: evaluationProfileSchema,
    ai: aiSettingsSchema,
    search: searchSettingsSchema,
    general: generalSettingsSchema,
    updatedAt: isoTimestamp,
  })
  .strict();

export const externalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => isSafeExternalUrl(value), 'Must be a valid http(s) URL without credentials');

/** Raw provider output. Deliberately forgiving: providers are untrusted and inconsistent. */
export const internshipCandidateSchema = z.object({
  title: trimmed(300),
  company: trimmed(200),
  url: externalUrl,
  source: trimmed(60).min(1),
  sourceId: trimmed(200).optional(),
  description: trimmed(20000).optional(),
  location: trimmed(200).optional(),
  country: trimmed(60).optional(),
  region: trimmed(80).optional(),
  workMode: trimmed(60).optional(),
  internshipType: trimmed(80).optional(),
  companyType: trimmed(80).optional(),
  technologies: z.array(trimmed(60)).max(60).optional(),
  skills: z.array(trimmed(60)).max(60).optional(),
  duration: trimmed(80).optional(),
  startDate: trimmed(40).optional(),
  deadline: trimmed(40).optional(),
  compensation: trimmed(120).optional(),
  publishedAt: trimmed(40).optional(),
  rawText: trimmed(20000).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

/** Same as above but with the fields we truly need to keep a record. */
export const internshipCandidateStrictSchema = internshipCandidateSchema.extend({
  title: trimmed(300).min(2),
  company: trimmed(200).min(1),
});

export const dedupeKeysSchema = z.object({
  canonicalUrl: z.string().nullable(),
  urlKey: z.string().nullable(),
  fingerprint: z.string().min(1),
});

export const manualOverrideSchema = z.object({
  score: scoreValue.optional(),
  matchLevel: trimmed(40).optional(),
  note: trimmed(400).optional(),
  at: isoTimestamp,
});

export const criterionScoreSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  score: scoreValue,
  weight: z.number().min(0),
  comment: trimmed(600).optional(),
});

export const evaluationRecommendationSchema = z.enum(['shortlist', 'consider', 'reject']);

export const evaluationStatusSchema = z.enum([
  'unevaluated',
  'queued',
  'processing',
  'completed',
  'failed',
]);

export const internshipEvaluationSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  profileId: z.string().min(1),
  profileName: z.string().min(1),
  score: scoreValue,
  matchLevel: z.string().min(1),
  criteria: z.array(criterionScoreSchema).max(20),
  reasons: z.array(trimmed(400)).max(20),
  concerns: z.array(trimmed(400)).max(20),
  recommendation: evaluationRecommendationSchema,
  summary: trimmed(1200),
  evaluatedAt: isoTimestamp,
  raw: trimmed(8000).optional(),
  fallback: z.boolean().optional(),
});

/**
 * The shape we require back from the LLM. It contains per-criterion scores only:
 * the overall score and match level are computed by us (see `score.ts`) so a
 * hallucinated total cannot inflate a record.
 */
export const evaluationResponseSchema = z.object({
  criteria: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        score: scoreValue,
        comment: trimmed(600).optional(),
      }),
    )
    .min(1)
    .max(20),
  reasons: z.array(trimmed(400).min(1).max(400)).max(10).default([]),
  concerns: z.array(trimmed(400).min(1).max(400)).max(10).default([]),
  recommendation: evaluationRecommendationSchema,
  summary: trimmed(1200).min(1),
});

/** Persisted internship document. */
export const internshipSchema = z.object({
  id: z.string().min(1).max(80),
  title: trimmed(300).min(1),
  company: trimmed(200).min(1),
  description: trimmed(20000).default(''),
  url: externalUrl,
  source: trimmed(60).min(1),
  sourceId: trimmed(200).optional(),
  location: trimmed(200).default(''),
  country: trimmed(60).optional(),
  region: trimmed(80).optional(),
  internshipType: trimmed(80).optional(),
  companyType: trimmed(80).optional(),
  technologies: z.array(trimmed(60)).max(60).default([]),
  skills: z.array(trimmed(60)).max(60).default([]),
  workMode: trimmed(60).optional(),
  duration: trimmed(80).optional(),
  startDate: trimmed(40).optional(),
  deadline: trimmed(40).optional(),
  compensation: trimmed(120).optional(),
  discoveredAt: isoTimestamp,
  updatedAt: isoTimestamp,
  status: trimmed(60).min(1),
  notes: trimmed(4000).optional(),
  rawText: trimmed(20000).optional(),
  evaluation: internshipEvaluationSchema.nullable().default(null),
  evaluationStatus: evaluationStatusSchema,
  evaluationError: trimmed(600).nullable().optional(),
  manualOverride: manualOverrideSchema.nullable().optional(),
  isDemo: z.boolean().optional(),
  dedupe: dedupeKeysSchema,
  extra: z.record(z.string(), z.unknown()).optional(),
});

/** Fields a user may change through the API (PATCH). */
export const internshipPatchSchema = z
  .object({
    title: trimmed(300).min(1),
    company: trimmed(200).min(1),
    description: trimmed(20000),
    url: externalUrl,
    location: trimmed(200),
    country: trimmed(60),
    region: trimmed(80),
    internshipType: trimmed(80),
    companyType: trimmed(80),
    workMode: trimmed(60),
    technologies: z.array(trimmed(60)).max(60),
    skills: z.array(trimmed(60)).max(60),
    duration: trimmed(80),
    startDate: trimmed(40),
    deadline: trimmed(40),
    compensation: trimmed(120),
    status: trimmed(60).min(1),
    notes: trimmed(4000),
    manualOverride: manualOverrideSchema.nullable(),
    reclassify: z.boolean(),
  })
  .partial()
  .strict();

/** Creating an internship by hand: same editable fields, but a title/company/url are required. */
export const createInternshipSchema = internshipPatchSchema.extend({
  title: trimmed(300).min(2),
  company: trimmed(200).min(1),
  url: externalUrl,
});

// ── Request schemas for the HTTP API ────────────────────────────────────────────────────

export const searchRequestSchema = z
  .object({
    query: trimmed(200).min(2),
    location: trimmed(120).optional(),
    country: trimmed(60).optional(),
    region: trimmed(80).optional(),
    workMode: trimmed(60).optional(),
    internshipType: trimmed(80).optional(),
    companyType: trimmed(80).optional(),
    technologies: z.array(trimmed(60)).max(20).optional(),
    publishedAfter: trimmed(40).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    providers: z.array(trimmed(60)).max(10).optional(),
    /**
     * Broad discovery: collect ALL software dev postings, because a company that is hiring
     * developers is usually also open to interns. When true, the internship-keyword gate is
     * skipped for this run (overrides the stored default).
     */
    broad: z.boolean().optional(),
  })
  .strict();

export const importRequestSchema = z
  .object({
    candidates: z.array(internshipCandidateSchema).min(1).max(200),
    isDemo: z.boolean().optional(),
  })
  .strict();

export const evaluateRequestSchema = z
  .object({
    ids: z.array(z.string().trim().min(1).max(80)).min(1).max(25),
    force: z.boolean().optional(),
  })
  .strict();

export const bulkRequestSchema = z
  .object({
    ids: z.array(z.string().trim().min(1).max(80)).min(1).max(500),
    action: z.enum(['status', 'shortlist', 'reject', 'delete', 'clear-evaluation', 'reset-status']),
    status: z.string().trim().max(60).optional(),
  })
  .strict();

export const settingsPatchSchema = z
  .object({
    profile: evaluationProfileSchema.partial().optional(),
    ai: aiSettingsSchema.partial().optional(),
    search: searchSettingsSchema.partial().optional(),
    general: generalSettingsSchema.partial().optional(),
  })
  .strict();

