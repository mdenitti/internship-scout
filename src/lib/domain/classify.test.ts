import { describe, expect, it } from 'vitest';

import {
  buildValueId,
  colorFor,
  defaultStatusId,
  labelFor,
  matchValue,
  rejectedStatusId,
  shortlistedStatusId,
  valuesForKind,
} from '@/lib/domain/classify';
import { referenceCounts, pruneReferences } from '@/lib/domain/references';
import { createDefaultClassifications } from '@/lib/domain/defaults';
import type { ClassificationValue } from '@/lib/domain/types';
import { makeInternship } from '@/test-support/factory';

const values = createDefaultClassifications();

describe('matchValue', () => {
  it('matches ids, labels and aliases', () => {
    expect(matchValue(values, 'workMode', 'remote')?.id).toBe('remote');
    expect(matchValue(values, 'workMode', 'WFH')?.id).toBe('remote');
    expect(matchValue(values, 'companyType', 'scale-up')?.id).toBe('startup');
  });

  it('prefers the longest match for free text', () => {
    expect(matchValue(values, 'companyType', 'a software agency in town')?.id).toBe('devshop');
    expect(matchValue(values, 'internshipType', 'machine learning internship')?.id).toBe('data-and-ai');
  });

  it('returns null for unknown text', () => {
    expect(matchValue(values, 'workMode', 'suborbital')).toBeNull();
    expect(matchValue(values, 'workMode', '')).toBeNull();
  });
});

describe('value helpers', () => {
  it('builds collision-free ids', () => {
    const taken = values.filter((value) => value.kind === 'workMode').map((value) => value.id);
    expect(taken).toContain('remote');
    const next = buildValueId(values, 'workMode', 'Remote');
    expect(next).not.toBe('remote');
    expect(next).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it('resolves the configured default statuses', () => {
    expect(defaultStatusId(values)).toBe('new');
    expect(shortlistedStatusId(values)).toBe('shortlisted');
    expect(rejectedStatusId(values)).toBe('rejected');
  });

  it('falls back to the raw value for unknown ids', () => {
    expect(labelFor(values, 'status', 'custom-status')).toBe('custom-status');
    expect(labelFor(values, 'status', 'shortlisted')).toBe('shortlisted');
    expect(colorFor(values, 'workMode', 'remote')).toBe('sage');
    expect(colorFor(values, 'workMode', 'unknown')).toBe('slate');
  });

  it('orders values by configured order then label', () => {
    const custom = [
      { id: 'b', kind: 'workMode', label: 'Beta', aliases: [], order: 1 },
      { id: 'a', kind: 'workMode', label: 'Zeta', aliases: [], order: 1 },
      { id: 'c', kind: 'workMode', label: 'Alpha', aliases: [], order: 0 },
    ] as ClassificationValue[];
    expect(valuesForKind(custom, 'workMode').map((value) => value.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('reference handling', () => {
  it('counts how often each value is used', () => {
    const internship = makeInternship({
      region: 'randstad',
      companyType: 'startup',
      technologies: ['TypeScript'],
      status: 'shortlisted',
    });
    const counts = referenceCounts(values, [internship]);
    expect(counts.randstad).toBe(1);
    expect(counts.startup).toBe(1);
    expect(counts.typescript).toBe(1);
    expect(counts.shortlisted).toBe(1);
    expect(counts.devshop).toBe(0);
  });

  it('prunes unknown references but always keeps the status', () => {
    const internship = makeInternship({
      region: 'atlantis',
      companyType: 'startup',
      workMode: 'teleportation',
      status: 'custom-status',
    });
    const result = pruneReferences(internship, values);
    expect(result.changed).toBe(true);
    expect(result.internship.region).toBeUndefined();
    expect(result.internship.workMode).toBeUndefined();
    expect(result.internship.companyType).toBe('startup');
    expect(result.internship.status).toBe('custom-status');
  });

  it('reports no change when every reference is valid', () => {
    const internship = makeInternship({ region: 'randstad', companyType: 'startup' });
    const result = pruneReferences(internship, values);
    expect(result.changed).toBe(false);
    expect(result.internship).toStrictEqual(internship);
  });
});
