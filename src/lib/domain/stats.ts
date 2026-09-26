import { effectiveScore, isEvaluated, isRejected, isShortlisted, scoreBucketLabel, SCORE_BUCKET_ORDER } from './score';
import type { Internship, InternshipStats } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function countBy(values: Array<string | undefined>): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
  }
  return sorted[middle] as number;
}

export function summarizeInternships(
  internships: readonly Internship[],
  options: { now?: Date } = {},
): InternshipStats {
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - 7 * DAY_MS;

  const scores = internships
    .map((internship) => effectiveScore(internship))
    .filter((score): score is number => score !== null);

  const buckets = new Map<string, number>(SCORE_BUCKET_ORDER.map((label) => [label, 0]));
  for (const internship of internships) {
    const label = scoreBucketLabel(effectiveScore(internship));
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  return {
    total: internships.length,
    discoveredLast7Days: internships.filter((internship) => {
      const timestamp = Date.parse(internship.discoveredAt);
      return !Number.isNaN(timestamp) && timestamp >= cutoff;
    }).length,
    evaluated: internships.filter(isEvaluated).length,
    unevaluated: internships.filter((internship) => internship.evaluationStatus === 'unevaluated').length,
    failed: internships.filter((internship) => internship.evaluationStatus === 'failed').length,
    shortlisted: internships.filter(isShortlisted).length,
    rejected: internships.filter(isRejected).length,
    averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    medianScore: median(scores),
    scoreBuckets: SCORE_BUCKET_ORDER.map((label) => ({ label, count: buckets.get(label) ?? 0 })),
    byCompanyType: countBy(internships.map((internship) => internship.companyType)).slice(0, 8),
    byWorkMode: countBy(internships.map((internship) => internship.workMode)).slice(0, 8),
    bySource: countBy(internships.map((internship) => internship.source)).slice(0, 8),
    demoCount: internships.filter((internship) => internship.isDemo).length,
  };
}
