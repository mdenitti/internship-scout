import { describe, expect, it } from 'vitest';

import { filterFromParams, pageFromParams, sortFromParams, toSearchParams } from '@/lib/util/search-params';

function params(input: string): URLSearchParams {
  return new URLSearchParams(input);
}

describe('filterFromParams', () => {
  it('reads list values from repeated and comma separated parameters', () => {
    const repeated = filterFromParams(params('status=new&status=shortlisted'));
    const commaSeparated = filterFromParams(params('status=new,shortlisted'));
    expect(repeated.status).toEqual(['new', 'shortlisted']);
    expect(commaSeparated.status).toEqual(['new', 'shortlisted']);
  });

  it('parses booleans and numbers, ignoring invalid values', () => {
    const filter = filterFromParams(
      params('scoreMin=60&scoreMax=oops&shortlistedOnly=true&includeDemo=false&hasEvaluation=1'),
    );
    expect(filter.scoreMin).toBe(60);
    expect(filter.scoreMax).toBeUndefined();
    expect(filter.shortlistedOnly).toBe(true);
    expect(filter.includeDemo).toBe(false);
    expect(filter.hasEvaluation).toBe(true);
  });

  it('drops unknown evaluation statuses', () => {
    expect(filterFromParams(params('evaluationStatus=completed,banana')).evaluationStatus).toEqual(['completed']);
  });
});

describe('toSearchParams round trip', () => {
  it('serializes a filter that reads back identically', () => {
    const filter = {
      text: 'react',
      status: ['new', 'shortlisted'],
      companyType: ['startup'],
      technologies: ['typescript'],
      scoreMin: 55,
      shortlistedOnly: true,
      includeDemo: false,
      company: 'acme',
    };
    const roundTripped = filterFromParams(toSearchParams({ filter }));
    expect(roundTripped).toEqual(filter);
  });

  it('keeps the URL tidy by omitting empty values', () => {
    const query = toSearchParams({ filter: { status: [], text: '' }, page: 1 }).toString();
    expect(query).toBe('');
  });
});

describe('sortFromParams', () => {
  it('uses the requested sort and falls back safely', () => {
    expect(sortFromParams(params('sort=deadline&direction=asc'))).toEqual({ field: 'deadline', direction: 'asc' });
    expect(sortFromParams(params('sort=nonsense&direction=sideways'))).toEqual({ field: 'score', direction: 'desc' });
  });
});

describe('pageFromParams', () => {
  it('clamps page and page size into a sane range', () => {
    expect(pageFromParams(params('page=-4&pageSize=100000'))).toEqual({ page: 1, pageSize: 200 });
    expect(pageFromParams(params(''), 25)).toEqual({ page: 1, pageSize: 25 });
  });
});
