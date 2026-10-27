import { describe, expect, it } from 'vitest';
import { csvCell, eventStats, matchesCsv, rankTeams, teamStats } from './analytics';
import { demoData } from './demo';
describe('transparent team analytics', () => {
  it('aggregates a 500-team, 50,000-observation event without changing results', () => {
    const data = demoData(),
      event = data.events[0];
    event.teams = Array.from({ length: 500 }, (_, index) => ({
      number: index + 1,
      name: 'Team ' + (index + 1),
    }));
    const matches = Array.from({ length: 50_000 }, (_, index) => ({
      ...data.matches[0],
      id: 'large-' + index,
      team: Math.floor(index / 100) + 1,
      match: (index % 100) + 1,
    }));
    const summaries = eventStats(event, matches);
    expect(summaries.size).toBe(500);
    expect(summaries.get(1)).toEqual(teamStats(event, matches, 1));
    expect(summaries.get(500)?.matches).toBe(100);
    expect(
      rankTeams(event, matches, { auto: 5, teleop: 5, endgame: 5 }, 5, 2, summaries),
    ).toHaveLength(500);
  });
  it('does not inflate matches when several scouts observe the same match', () => {
    const data = demoData(),
      event = data.events[0],
      original = data.matches.filter((m) => m.team === 6901);
    const duplicate = { ...original[0], id: 'another-observer', scout: 'Another scout' };
    const stats = teamStats(event, [...original, duplicate], 6901);
    expect(stats.observations).toBe(5);
    expect(stats.matches).toBe(4);
    expect(stats.average).toBe(teamStats(event, original, 6901).average);
  });
  it('excludes conflicting team–match pairs from estimates', () => {
    const data = demoData(),
      event = data.events[0],
      original = data.matches.filter((m) => m.team === 6901);
    const dispute = {
      ...original[0],
      id: 'disputed',
      values: { ...original[0].values, auto: 999 },
    };
    const stats = teamStats(event, [...original, dispute], 6901);
    expect(stats.conflicts).toBe(1);
    expect(stats.matches).toBe(3);
    expect(stats.average).toBe(teamStats(event, original.slice(1), 6901).average);
  });
  it('keeps unscouted estimates empty and ranks all-zero priorities safely', () => {
    const data = demoData(),
      event = data.events[0];
    const stats = teamStats(event, [], 254);
    expect(stats.matches).toBe(0);
    expect(stats.average).toBe(0);
    expect(rankTeams(event, data.matches, {}, 0, 0).every((t) => t.rankScore === 0)).toBe(true);
    const ranked = rankTeams(event, data.matches, { auto: 10, teleop: 5, endgame: 1 }, 5, 0);
    expect(
      ranked.every((t) => Number.isFinite(t.rankScore) && t.rankScore >= 0 && t.rankScore <= 100),
    ).toBe(true);
  });
  it('reports disabled reliability using distinct matches', () => {
    const data = demoData();
    const stats = teamStats(data.events[0], data.matches, 2056);
    expect(stats.reliability).toBe(75);
  });
});
describe('spreadsheet-safe CSV', () => {
  it('quotes delimiters, quotes and formulas including whitespace prefixes', () => {
    expect(csvCell('=HYPERLINK("url")')).toBe('"' + "'=HYPERLINK(" + '""url"")"');
    expect(csvCell('  +1')).toBe('"\'  +1"');
    expect(csvCell('comma, newline\nhere')).toBe('"comma, newline\nhere"');
  });
  it('includes raw IDs and event metric headings', () => {
    const data = demoData(),
      csv = matchesCsv(data.events[0], data.matches);
    expect(csv).toContain('"Record ID"');
    expect(csv).toContain('"Auto pieces scored"');
    expect(csv).toContain('demo-6901-1');
  });
});
