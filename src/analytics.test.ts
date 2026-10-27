import { describe, expect, it } from 'vitest';
import { csvCell, matchesCsv, rankTeams, teamStats } from './analytics';
import { demoData } from './demo';
describe('transparent team analytics', () => {
  it('does not inflate matches when several scouts observe the same match', () => {
    const data = demoData(), event = data.events[0], original = data.matches.filter(m => m.team === 6901);
    const duplicate = { ...original[0], id: 'another-observer', scout: 'Another scout' };
    const stats = teamStats(event, [...original, duplicate], 6901);
    expect(stats.observations).toBe(5); expect(stats.matches).toBe(4);
    expect(stats.average).toBe(teamStats(event, original, 6901).average);
  });
  it('excludes conflicting team–match pairs from estimates', () => {
    const data = demoData(), event = data.events[0], original = data.matches.filter(m => m.team === 6901);
    const dispute = { ...original[0], id: 'disputed', values: { ...original[0].values, auto: 999 } };
    const stats = teamStats(event, [...original, dispute], 6901);
    expect(stats.conflicts).toBe(1); expect(stats.matches).toBe(3);
    expect(stats.average).toBe(teamStats(event, original.slice(1), 6901).average);
  });
  it('keeps unscouted estimates empty and ranks all-zero priorities safely', () => {
    const data = demoData(), event = data.events[0];
    const stats = teamStats(event, [], 254); expect(stats.matches).toBe(0); expect(stats.average).toBe(0);
    expect(rankTeams(event, data.matches, {}, 0, 0).every(t => t.rankScore === 0)).toBe(true);
    const ranked = rankTeams(event, data.matches, { auto: 10, teleop: 5, endgame: 1 }, 5, 0);
    expect(ranked.every(t => Number.isFinite(t.rankScore) && t.rankScore >= 0 && t.rankScore <= 100)).toBe(true);
  });
  it('reports disabled reliability using distinct matches', () => {
    const data = demoData(); const stats = teamStats(data.events[0], data.matches, 2056);
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
    const data = demoData(), csv = matchesCsv(data.events[0], data.matches);
    expect(csv).toContain('"Record ID"'); expect(csv).toContain('"Auto pieces scored"'); expect(csv).toContain('demo-6901-1');
  });
});
