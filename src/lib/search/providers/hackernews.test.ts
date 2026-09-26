import { describe, expect, it } from 'vitest';

import { mapComment, parseHiringLine } from './hackernews';

const NL = String.fromCharCode(10);

const hiringComment = {
  objectID: '123',
  comment_text: [
    'Acme BV | Frontend Intern | Utrecht (hybrid)',
    '',
    'We are looking for a TypeScript and React intern to join the team for at least six months. You will work on our customer portal alongside two senior engineers.',
  ].join(NL),
  story_title: 'Ask HN: Who is hiring? (September 2026)',
  author: 'acme_ceo',
  created_at: '2026-09-01T10:00:00.000Z',
};

describe('parseHiringLine', () => {
  it('splits the conventional company | role | location line', () => {
    expect(parseHiringLine('Acme | Frontend Intern | Utrecht\n\nBody')).toEqual({
      company: 'Acme',
      role: 'Frontend Intern',
      location: 'Utrecht',
    });
  });

  it('gives up on lines that are not pipe separated', () => {
    expect(parseHiringLine('Just a normal sentence without pipes.')).toEqual({});
  });
});

describe('mapComment', () => {
  it('keeps comments from hiring threads', () => {
    const candidate = mapComment(hiringComment);
    expect(candidate).not.toBeNull();
    expect(candidate?.company).toBe('Acme BV');
    expect(candidate?.title).toBe('Frontend Intern');
    expect(candidate?.url).toBe('https://news.ycombinator.com/item?id=123');
    expect(candidate?.location).toBe('Utrecht (hybrid)');
  });

  it('drops off-topic comments from unrelated threads', () => {
    const offTopic = {
      ...hiringComment,
      story_title: 'Show HN: A database written in Rust',
      comment_text:
        'This article is about query planning in a new relational database. The author explains how index scans are chosen and why the planner sometimes picks a full scan even when an index exists on that column in question.',
    };
    // Neither a hiring thread nor a "Company | Role" first line → discarded.
    expect(mapComment(offTopic)).toBeNull();
  });

  it('keeps conventionally formatted comments even outside hiring threads', () => {
    const formatted = { ...hiringComment, story_title: 'Ask HN: How did you get your first job?' };
    expect(mapComment(formatted)).not.toBeNull();
  });

  it('rejects tiny or id-less hits', () => {
    expect(mapComment({ objectID: '1', comment_text: 'too short' })).toBeNull();
    expect(mapComment({ comment_text: hiringComment.comment_text })).toBeNull();
  });
});
