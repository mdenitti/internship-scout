/**
 * Core domain types for the internship discovery platform.
 *
 * Design rules:
 *  - Classification-ish fields (company type, location, work mode, internship type,
 *    region, status, technologies...) are plain `string` values that live in the
 *    configurable classification registry. Nothing about *which* categories exist is
 *    hard-coded in business logic; only the seed data in `defaults.ts` suggests values.
 *  - Records are extensible: `extra` and the `criteria` arrays keep room for new fields
 *    without migrations.
 */

export type ISODateString = string;

/** Kinds of configurable classification values. Extend by adding a kind to the registry. */
export const CLASSIFICATION_KINDS = [
  'companyType',
  'location',
  'region',
  'country',
  'workMode',
  'internshipType',
  'technology',
  'status',
] as const;

export type ClassificationKind = (typeof CLASSIFICATION_KINDS)[number];

export interface ClassificationValue {
  id: string;
  kind: ClassificationKind;
  label: string;
  /** Optional free-text description shown in the settings UI. */
  description?: string;
  /** Alternate spellings / synonyms used by the normalizer when matching raw text. */
  aliases: string[];
  /** Accent colour token used by the UI (`terracotta`, `sage`, `sky`, `sand`, `plum`). */
  color?: ClassificationColor;
  /** Seed values are editable but flagged so the UI can offer "reset to defaults". */
  builtin?: boolean;
  /** Lower numbers sort first in the UI. */
  order?: number;
}

export type ClassificationColor = 'terracotta' | 'sage' | 'sky' | 'sand' | 'plum' | 'slate';

export interface Classifications {
  values: ClassificationValue[];
}

/** A normalized internship record as persisted. */
export interface Internship {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: string;
  /** Provider-specific identifier (job id, comment id...) when available. */
  sourceId?: string;
  /** Human readable location as published by the source. */
  location: string;
  country?: string;
  region?: string;
  internshipType?: string;
  companyType?: string;
  technologies: string[];
  skills: string[];
  workMode?: string;
  duration?: string;
  startDate?: string;
  deadline?: string;
  compensation?: string;
  /** When we first saw this opportunity. */
  discoveredAt: ISODateString;
  updatedAt: ISODateString;
  status: string;
  notes?: string;
  /** Untrusted source text kept for auditing / re-normalization. */
  rawText?: string;
  evaluation: InternshipEvaluation | null;
  evaluationStatus: EvaluationStatus;
  evaluationError?: string | null;
  /** Manual score/level wins over the AI result for sorting and filtering. */
  manualOverride?: ManualOverride | null;
  /** True for seeded demo records: easy to identify and delete. */
  isDemo?: boolean;
  dedupe: DedupeKeys;
  extra?: Record<string, unknown>;
}

export type EvaluationStatus = 'unevaluated' | 'queued' | 'processing' | 'completed' | 'failed';

export interface DedupeKeys {
  /** Fully canonicalised URL (tracking params stripped, host normalised). */
  canonicalUrl: string | null;
  /** Host + path only, used as a looser duplicate signal. */
  urlKey: string | null;
  /** company|title|location slug. */
  fingerprint: string;
}

export interface ManualOverride {
  score?: number;
  matchLevel?: string;
  note?: string;
  at: ISODateString;
}

export interface CriterionScore {
  key: string;
  label: string;
  /** 0-100 score returned by the model for this criterion. */
  score: number;
  weight: number;
  comment?: string;
}

export interface InternshipEvaluation {
  provider: string;
  model: string;
  profileId: string;
  profileName: string;
  /** Weighted 0-100 score computed by `computeEvaluationScore`, not trusted from the model. */
  score: number;
  matchLevel: string;
  criteria: CriterionScore[];
  reasons: string[];
  concerns: string[];
  recommendation: EvaluationRecommendation;
  summary: string;
  evaluatedAt: ISODateString;
  /** Truncated raw model output, kept for debugging and auditing. */
  raw?: string;
  /** Set when the evaluation came from the deterministic fallback provider. */
  fallback?: boolean;
}

export type EvaluationRecommendation = 'shortlist' | 'consider' | 'reject';

export interface EvaluationCriterion {
  key: string;
  label: string;
  weight: number;
  description?: string;
}

export interface MatchLevel {
  id: string;
  label: string;
  minScore: number;
}

/** User-configurable definition of what a good internship looks like. */
export interface EvaluationProfile {
  id: string;
  name: string;
  description?: string;
  targetTechnologies: string[];
  preferredLocations: string[];
  preferredRegions: string[];
  preferredCompanyTypes: string[];
  preferredWorkModes: string[];
  preferredInternshipTypes: string[];
  /** Free-text signals that should raise the score. */
  boostKeywords: string[];
  /** Free-text signals that should lower the score (e.g. "unpaid", "sales"). */
  avoidKeywords: string[];
  /** Score below which an internship is considered not relevant. */
  minRelevance: number;
  criteria: EvaluationCriterion[];
  matchLevels: MatchLevel[];
  updatedAt: ISODateString;
}

export interface AiSettings {
  /** `pollinations` (LLM) or `heuristic` (deterministic, offline). */
  provider: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  /** How many evaluations may run in parallel. Hard-capped server side. */
  concurrency: number;
  /** Minimum delay between two outbound requests to the provider (rate-limit friendly). */
  minDelayMs: number;
  /** Allow automatic fallback to the heuristic evaluator when the LLM fails. */
  allowHeuristicFallback: boolean;
}

export interface SearchSettings {
  /** Provider ids that are enabled for discovery, in priority order. */
  enabledProviders: string[];
  defaultQuery: string;
  resultsPerProvider: number;
  timeoutMs: number;
  /** Contact string sent to providers that ask for one. Not a secret. */
  contact: string;
  /**
   * Words that make a posting an internship. Used to drop obviously unrelated jobs from
   * generic job board results. Fully editable: nothing in the code assumes these values.
   */
  internshipKeywords: string[];
  /** When true, results must contain at least one internship keyword. */
  requireInternshipKeyword: boolean;
}

export interface GeneralSettings {
  autoSeedDemo: boolean;
}

export interface AppSettings {
  profile: EvaluationProfile;
  ai: AiSettings;
  search: SearchSettings;
  general: GeneralSettings;
  updatedAt: ISODateString;
}

/** Raw, untrusted candidate produced by a search provider. */
export interface InternshipCandidate {
  title: string;
  company: string;
  url: string;
  source: string;
  sourceId?: string;
  description?: string;
  location?: string;
  country?: string;
  region?: string;
  workMode?: string;
  internshipType?: string;
  companyType?: string;
  technologies?: string[];
  skills?: string[];
  duration?: string;
  startDate?: string;
  deadline?: string;
  compensation?: string;
  publishedAt?: string;
  rawText?: string;
  extra?: Record<string, unknown>;
}

export interface InternshipSearchQuery {
  query: string;
  location?: string;
  country?: string;
  region?: string;
  workMode?: string;
  internshipType?: string;
  companyType?: string;
  technologies?: string[];
  /** Only return opportunities published on/after this date. */
  publishedAfter?: string;
  limit?: number;
  providers?: string[];
}

export interface ProviderSearchOutcome {
  provider: string;
  label: string;
  candidates: InternshipCandidate[];
  error?: { message: string; code: string };
  durationMs: number;
}

export interface DuplicateMatch {
  reason: 'canonical-url' | 'url' | 'fingerprint' | 'source-id';
  existingId: string;
  existingTitle: string;
  existingCompany: string;
}

export interface SearchResultItem {
  candidate: InternshipCandidate;
  duplicate: DuplicateMatch | null;
  /** How the normalizer interpreted the candidate; shown in the search console preview. */
  preview?: InternshipPreview;
}

/** The derived fields shown when previewing a candidate before importing it. */
export type InternshipPreview = Pick<
  Internship,
  | 'title'
  | 'company'
  | 'location'
  | 'region'
  | 'country'
  | 'workMode'
  | 'internshipType'
  | 'companyType'
  | 'technologies'
  | 'deadline'
  | 'duration'
  | 'compensation'
>;

export type InternshipFilter = {
  text?: string;
  status?: string[];
  evaluationStatus?: EvaluationStatus[];
  companyType?: string[];
  region?: string[];
  location?: string;
  workMode?: string[];
  internshipType?: string[];
  technologies?: string[];
  company?: string;
  scoreMin?: number;
  scoreMax?: number;
  shortlistedOnly?: boolean;
  hasEvaluation?: boolean;
  discoveredAfter?: string;
  deadlineBefore?: string;
  sources?: string[];
  includeDemo?: boolean;
  demoOnly?: boolean;
};

export type InternshipSortField = 'score' | 'company' | 'location' | 'discoveredAt' | 'deadline' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface InternshipSort {
  field: InternshipSortField;
  direction: SortDirection;
}

export interface InternshipStats {
  total: number;
  discoveredLast7Days: number;
  evaluated: number;
  unevaluated: number;
  failed: number;
  shortlisted: number;
  rejected: number;
  averageScore: number | null;
  medianScore: number | null;
  scoreBuckets: Array<{ label: string; count: number }>;
  byCompanyType: Array<{ value: string; count: number }>;
  byWorkMode: Array<{ value: string; count: number }>;
  bySource: Array<{ value: string; count: number }>;
  demoCount: number;
}

