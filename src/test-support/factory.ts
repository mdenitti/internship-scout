import { buildDedupeKeys } from '@/lib/domain/normalize';
import type { EvaluationProfile, Internship, InternshipEvaluation } from '@/lib/domain/types';

/**
 * Small factory for tests: a fully valid internship record with sensible defaults, so each
 * test only states the fields it actually exercises.
 */

let counter = 0;

export function makeInternship(overrides: Partial<Internship> = {}): Internship {
  const base: Internship = {
    id: `test-${++counter}`,
    title: 'Software Engineering Intern',
    company: 'Acme',
    description: 'Build features with the team.',
    url: 'https://example.com/jobs/frontend-intern',
    source: 'manual',
    location: 'Utrecht',
    country: 'NL',
    technologies: ['TypeScript'],
    skills: [],
    discoveredAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    status: 'new',
    evaluation: null,
    evaluationStatus: 'unevaluated',
    dedupe: { canonicalUrl: null, urlKey: null, fingerprint: '' },
  };

  const internship: Internship = { ...base, ...overrides };
  if (!overrides.dedupe) {
    internship.dedupe = buildDedupeKeys({
      url: internship.url,
      company: internship.company,
      title: internship.title,
      location: internship.location,
    });
  }
  return internship;
}

export function makeEvaluation(overrides: Partial<InternshipEvaluation> = {}): InternshipEvaluation {
  return {
    provider: 'heuristic',
    model: 'heuristic',
    profileId: 'default',
    profileName: 'Default profile',
    score: 70,
    matchLevel: 'good',
    criteria: [],
    reasons: ['Matches your target stack.'],
    concerns: [],
    recommendation: 'consider',
    summary: 'A solid match.',
    evaluatedAt: '2026-01-12T00:00:00.000Z',
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<EvaluationProfile> = {}): EvaluationProfile {
  return {
    id: 'test-profile',
    name: 'Test profile',
    targetTechnologies: ['TypeScript'],
    preferredLocations: ['Utrecht'],
    preferredRegions: [],
    preferredCompanyTypes: [],
    preferredWorkModes: [],
    preferredInternshipTypes: [],
    boostKeywords: [],
    avoidKeywords: [],
    minRelevance: 50,
    criteria: [
      { key: 'stack', label: 'Stack match', weight: 2 },
      { key: 'location', label: 'Location', weight: 1 },
    ],
    matchLevels: [
      { id: 'excellent', label: 'Excellent', minScore: 80 },
      { id: 'good', label: 'Good', minScore: 60 },
      { id: 'weak', label: 'Weak', minScore: 30 },
      { id: 'poor', label: 'Poor', minScore: 0 },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
