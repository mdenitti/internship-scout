import { describe, expect, it } from 'vitest';

import { partitionDuplicates, previewDuplicate } from '@/lib/domain/dedupe';
import { makeInternship } from '@/test-support/factory';

describe('duplicate detection', () => {
  it('matches the same posting discovered with tracking parameters', () => {
    const stored = makeInternship({ url: 'https://example.com/jobs/1?ref=board' });
    const incoming = makeInternship({ url: 'https://example.com/jobs/1?utm_source=twitter' });
    const { fresh, duplicates } = partitionDuplicates([incoming], [stored]);
    expect(fresh).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.match.reason).toBe('canonical-url');
  });

  it('matches on fingerprint when URLs differ but the posting is the same', () => {
    const stored = makeInternship({ url: 'https://boards.example/acme-role' });
    const incoming = makeInternship({ url: 'https://jobs.example/acme-role' });
    const { duplicates } = partitionDuplicates([incoming], [stored]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.match.reason).toBe('fingerprint');
  });

  it('collapses duplicates within the same batch', () => {
    const one = makeInternship({});
    const two = makeInternship({});
    const { fresh, duplicates } = partitionDuplicates([one, two], []);
    expect(fresh).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.match.existingId).toBe(one.id);
  });

  it('keeps genuinely different postings', () => {
    const one = makeInternship({ title: 'Frontend Intern', company: 'Acme', url: 'https://example.com/jobs/frontend' });
    const two = makeInternship({ title: 'Data Intern', company: 'Beta', url: 'https://example.com/jobs/data' });
    const { fresh, duplicates } = partitionDuplicates([one, two], []);
    expect(fresh).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });

  it('previews duplicates for search results without importing', () => {
    const stored = makeInternship({ url: 'https://example.com/jobs/42' });
    const match = previewDuplicate(
      { title: 'Anything', company: 'Any', url: 'https://example.com/jobs/42?fbclid=abc', source: 'x' },
      [stored],
    );
    expect(match?.existingId).toBe(stored.id);
    expect(previewDuplicate({ title: 'x', company: 'y', url: 'https://example.com/other', source: 'x' }, [stored])).toBeNull();
  });
});
