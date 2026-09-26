import { describe, expect, it } from 'vitest';

import { createDefaultClassifications } from '@/lib/domain/defaults';
import {
  buildDedupeKeys,
  normalizeCandidate,
  normalizeCompany,
  normalizeTitle,
} from '@/lib/domain/normalize';

const classifications = createDefaultClassifications();

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Senior Software Engineer Intern (m/f/d) | Remote',
    company: 'Acme B.V.',
    url: 'https://www.example.com/jobs/frontend-intern?utm_source=board&utm_campaign=x',
    source: 'test-provider',
    description: 'Work with TypeScript and React on our platform. Fully remote team.',
    location: 'Utrecht, Netherlands',
    ...overrides,
  };
}

describe('normalizeTitle', () => {
  it('strips recruiter noise such as (m/f/d) and "| Remote"', () => {
    expect(normalizeTitle('Senior Software Engineer Intern (m/f/d) | Remote')).toBe(
      'Senior Software Engineer Intern',
    );
    expect(normalizeTitle('Frontend Intern – Remote')).toBe('Frontend Intern');
  });

  it('rejects titles that reduce to nothing', () => {
    expect(normalizeTitle('   ')).toBe('');
  });
});

describe('normalizeCompany', () => {
  it('drops legal entity suffixes', () => {
    expect(normalizeCompany('Acme B.V.')).toBe('Acme');
    expect(normalizeCompany('Globex GmbH')).toBe('Globex');
  });

  it('keeps a single-word company intact', () => {
    expect(normalizeCompany('Acme')).toBe('Acme');
  });
});

describe('normalizeCandidate', () => {
  it('normalizes a complete candidate into a storable record', () => {
    const outcome = normalizeCandidate(candidate() as never, {
      classifications,
      idFactory: () => 'fixed-id',
      now: () => new Date('2026-02-01T10:00:00.000Z'),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const record = outcome.internship;
    expect(record.id).toBe('fixed-id');
    expect(record.title).toBe('Senior Software Engineer Intern');
    expect(record.company).toBe('Acme');
    // www and tracking parameters are removed during canonicalisation
    expect(record.url).toBe('https://example.com/jobs/frontend-intern');
    expect(record.status).toBe('new');
    expect(record.discoveredAt).toBe('2026-02-01T10:00:00.000Z');
    expect(record.country).toBe('NL');
    expect(record.region).toBe('randstad');
    expect(record.workMode).toBe('remote');
    expect(record.technologies).toEqual(expect.arrayContaining(['TypeScript', 'React']));
    expect(record.evaluationStatus).toBe('unevaluated');
    expect(record.dedupe.canonicalUrl).toBe('https://example.com/jobs/frontend-intern');
    expect(record.dedupe.fingerprint).toContain('acme');
  });

  it('rejects candidates without a usable URL', () => {
    const outcome = normalizeCandidate(candidate({ url: 'not a url' }) as never, { classifications });
    expect(outcome).toEqual({ ok: false, reason: 'Unusable or unsafe application URL' });
  });

  it('rejects candidates without a real title or company', () => {
    expect(normalizeCandidate(candidate({ title: 'x' }) as never, { classifications }).ok).toBe(false);
    expect(normalizeCandidate(candidate({ company: 'A' }) as never, { classifications }).ok).toBe(false);
  });

  it('applies the configured status when provided', () => {
    const outcome = normalizeCandidate(candidate() as never, { classifications, statusId: 'reviewing' });
    expect(outcome.ok && outcome.internship.status).toBe('reviewing');
  });
});

describe('buildDedupeKeys', () => {
  it('produces identical fingerprints for equivalent postings', () => {
    const first = buildDedupeKeys({ url: 'https://a.example/j/1', company: 'Acme B.V.', title: 'Frontend Intern', location: 'Utrecht' });
    const second = buildDedupeKeys({ url: 'https://other.example/j/9', company: 'acme', title: 'frontend', location: 'Utrecht, Netherlands' });
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.canonicalUrl).not.toBe(second.canonicalUrl);
  });
});
