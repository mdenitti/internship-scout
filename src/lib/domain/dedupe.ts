import type { DuplicateMatch, Internship, InternshipCandidate } from './types';
import { buildDedupeKeys } from './normalize';

/**
 * Duplicate detection.
 *
 * Signals, strongest first:
 *  1. canonical URL   (same posting, tracking params removed)
 *  2. source id       (same provider + same upstream id)
 *  3. URL key         (host + path, query ignored)
 *  4. fingerprint     (company | title | first location part)
 *
 * Everything is computed from normalized values, so the same posting discovered twice
 * through two providers is recognised as one record.
 */

export function duplicateSignal(incoming: Internship, existing: Internship): DuplicateMatch['reason'] | null {
  if (incoming.dedupe.canonicalUrl && incoming.dedupe.canonicalUrl === existing.dedupe.canonicalUrl) {
    return 'canonical-url';
  }
  if (
    incoming.sourceId &&
    existing.sourceId &&
    incoming.source === existing.source &&
    incoming.sourceId === existing.sourceId
  ) {
    return 'source-id';
  }
  if (incoming.dedupe.urlKey && incoming.dedupe.urlKey === existing.dedupe.urlKey) {
    return 'url';
  }
  if (incoming.dedupe.fingerprint && incoming.dedupe.fingerprint === existing.dedupe.fingerprint) {
    return 'fingerprint';
  }
  return null;
}

export function findDuplicate(
  incoming: Internship,
  existing: readonly Internship[],
): DuplicateMatch | null {
  let best: { reason: DuplicateMatch['reason']; existing: Internship } | null = null;
  const strength: Record<DuplicateMatch['reason'], number> = {
    'canonical-url': 4,
    'source-id': 3,
    url: 2,
    fingerprint: 1,
  };

  for (const candidate of existing) {
    const reason = duplicateSignal(incoming, candidate);
    if (!reason) continue;
    if (!best || strength[reason] > strength[best.reason]) best = { reason, existing: candidate };
    if (best.reason === 'canonical-url') break;
  }

  if (!best) return null;
  return {
    reason: best.reason,
    existingId: best.existing.id,
    existingTitle: best.existing.title,
    existingCompany: best.existing.company,
  };
}

/**
 * Import pipeline helper: splits normalized candidates into "new" records and duplicates,
 * also collapsing duplicates *within* the same batch (two providers returning the same post).
 */
export function partitionDuplicates(
  incoming: readonly Internship[],
  existing: readonly Internship[],
): {
  fresh: Internship[];
  duplicates: Array<{ internship: Internship; match: DuplicateMatch }>;
} {
  const fresh: Internship[] = [];
  const duplicates: Array<{ internship: Internship; match: DuplicateMatch }> = [];
  const seen = [...existing];

  for (const internship of incoming) {
    const match = findDuplicate(internship, seen);
    if (match) {
      duplicates.push({ internship, match });
      continue;
    }
    fresh.push(internship);
    seen.push(internship);
  }

  return { fresh, duplicates };
}

/** Preview helper used by the search console before anything is imported. */
export function previewDuplicate(
  candidate: InternshipCandidate,
  existing: readonly Internship[],
): DuplicateMatch | null {
  if (!candidate.url) return null;
  const keys = buildDedupeKeys({
    url: candidate.url,
    company: candidate.company ?? '',
    title: candidate.title ?? '',
    location: candidate.location,
  });
  const pseudo: Internship = {
    id: '__candidate__',
    title: candidate.title ?? '',
    company: candidate.company ?? '',
    description: '',
    url: candidate.url,
    source: candidate.source ?? 'unknown',
    sourceId: candidate.sourceId,
    location: candidate.location ?? '',
    technologies: [],
    skills: [],
    discoveredAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    status: 'new',
    evaluation: null,
    evaluationStatus: 'unevaluated',
    dedupe: keys,
  };
  const match = findDuplicate(pseudo, existing);
  return match ? { ...match, existingId: match.existingId } : null;
}
