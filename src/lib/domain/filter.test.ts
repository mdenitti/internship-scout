import { describe, expect, it } from 'vitest';

import { collectFilterOptions, filterInternships, paginate, sortInternships } from '@/lib/domain/filter';
import { makeEvaluation, makeInternship } from '@/test-support/factory';

const scored = (score: number, overrides = {}) =>
  makeInternship({
    evaluation: makeEvaluation({ score }),
    evaluationStatus: 'completed',
    ...overrides,
  });

describe('filterInternships', () => {
  const items = [
    scored(80, { title: 'React Intern', company: 'Acme', location: 'Utrecht', status: 'shortlisted', technologies: ['React'] }),
    scored(45, { title: 'Python Intern', company: 'Beta', location: 'Antwerp', status: 'rejected' }),
    makeInternship({ title: 'Go Intern', company: 'Gamma', location: 'Remote' }),
  ];

  it('requires every text term to match', () => {
    expect(filterInternships(items, { text: 'react intern' })).toHaveLength(1);
    expect(filterInternships(items, { text: 'react golang' })).toHaveLength(0);
  });

  it('filters by status, company and location', () => {
    expect(filterInternships(items, { status: ['shortlisted'] })).toHaveLength(1);
    expect(filterInternships(items, { company: 'bet' })).toHaveLength(1);
    expect(filterInternships(items, { location: 'trecht' })).toHaveLength(1);
  });

  it('honours shortlistedOnly', () => {
    expect(filterInternships(items, { shortlistedOnly: true })).toHaveLength(1);
  });

  it('filters on the effective score, treating unscored records as excluded', () => {
    expect(filterInternships(items, { scoreMin: 60 })).toHaveLength(1);
    expect(filterInternships(items, { scoreMax: 50 })).toHaveLength(1);
    expect(filterInternships(items, { scoreMin: 0 })).toHaveLength(2);
  });

  it('uses the manual override when filtering by score', () => {
    const withOverride = makeInternship({
      evaluation: makeEvaluation({ score: 20 }),
      evaluationStatus: 'completed',
      manualOverride: { score: 95, at: '2026-01-01T00:00:00.000Z' },
    });
    expect(filterInternships([withOverride], { scoreMin: 90 })).toHaveLength(1);
  });

  it('can hide demo records', () => {
    const demo = makeInternship({ isDemo: true });
    expect(filterInternships([demo], { includeDemo: false })).toHaveLength(0);
    expect(filterInternships([demo], { demoOnly: true })).toHaveLength(1);
  });

  it('filters by evaluation status', () => {
    expect(filterInternships(items, { evaluationStatus: ['unevaluated'] })).toHaveLength(1);
  });
});

describe('sortInternships', () => {
  it('sorts by score descending with unscored records last', () => {
    const items = [makeInternship({ title: 'Unscored' }), scored(50, { title: 'Mid' }), scored(90, { title: 'Top' })];
    const sorted = sortInternships(items, { field: 'score', direction: 'desc' });
    expect(sorted.map((item) => item.title)).toEqual(['Top', 'Mid', 'Unscored']);
  });

  it('sorts by title ascending', () => {
    const items = [scored(10, { title: 'Zebra' }), scored(10, { title: 'Alpha' })];
    const sorted = sortInternships(items, { field: 'title', direction: 'asc' });
    expect(sorted.map((item) => item.title)).toEqual(['Alpha', 'Zebra']);
  });

  it('sorts by deadline with missing deadlines last', () => {
    const items = [scored(10, { title: 'No deadline' }), scored(10, { title: 'Soon', deadline: '2026-03-01' })];
    const sorted = sortInternships(items, { field: 'deadline', direction: 'asc' });
    expect(sorted.map((item) => item.title)).toEqual(['Soon', 'No deadline']);
  });
});

describe('paginate and options', () => {
  it('clamps the page into range', () => {
    const items = Array.from({ length: 12 }, (_, index) => makeInternship({ title: `Item ${index}` }));
    const page = paginate(items, 99, 5);
    expect(page.page).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.pageCount).toBe(3);
    expect(page.total).toBe(12);
  });

  it('collects distinct filter options from the data', () => {
    const options = collectFilterOptions([
      scored(80, { companyType: 'startup', workMode: 'remote', technologies: ['TypeScript'] }),
      scored(70, { companyType: 'startup', workMode: 'hybrid', technologies: ['TypeScript', 'React'] }),
    ]);
    expect(options.companyTypes).toEqual(['startup']);
    expect(options.workModes).toEqual(['hybrid', 'remote']);
    expect(options.technologies).toEqual(['React', 'TypeScript']);
    expect(options.statuses).toEqual(['new']);
  });
});
