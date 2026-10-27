import { describe, expect, it } from 'vitest';
import { bundle, conflicts, defaultMetrics, mergeData, parseBundle } from './domain';
import type { Data, Match, ScoutEvent } from './domain';
import { demoData } from './demo';

const stamp = '2026-01-01T12:00:00.000Z';
function fixture(): Data {
  const event: ScoutEvent = { id: 'event', name: 'Practice', location: '', date: '2026-01-01', season: 2026, demo: false, metrics: defaultMetrics(), teams: [{ number: 1, name: 'One' }], updatedAt: stamp };
  const row: Match = { id: 'match', eventId: event.id, team: 1, match: 1, scout: 'Scout', alliance: 'red', values: { auto: 2, teleop: 5, endgame: 1 }, disabled: false, defense: 3, notes: '', createdAt: stamp, updatedAt: stamp };
  return { events: [event], matches: [row], pits: [] };
}
describe('versioned data boundaries', () => {
  it('round trips a complete backup and demo fixture', () => { expect(parseBundle(JSON.stringify(bundle(fixture()))).data).toEqual(fixture()); expect(parseBundle(JSON.stringify(bundle(demoData()))).data.matches.length).toBe(30); });
  it('rejects invalid JSON, future schemas and oversize input', () => {
    expect(() => parseBundle('{bad')).toThrow(/valid JSON/);
    expect(() => parseBundle(JSON.stringify({ ...bundle(fixture()), schemaVersion: 2 }))).toThrow(/unsupported/);
    expect(() => parseBundle('x'.repeat(10_000_001))).toThrow(/10 MB/);
  });
  it('rejects invalid references, duplicate IDs and unknown metric keys', () => {
    const data = fixture(); data.matches[0].team = 2; expect(() => parseBundle(JSON.stringify(bundle(data)))).toThrow(/missing/);
    const dup = fixture(); dup.matches.push(dup.matches[0]); expect(() => parseBundle(JSON.stringify(bundle(dup)))).toThrow(/Duplicate/);
    const metric = fixture(); metric.matches[0].values.unknown = 4; expect(() => parseBundle(JSON.stringify(bundle(metric)))).toThrow(/metrics/);
  });
  it('rejects impossible dates, nonintegral counts and invalid boolean metrics', () => {
    const date = fixture(); date.events[0].date = '2026-02-31'; expect(() => parseBundle(JSON.stringify(bundle(date)))).toThrow();
    const data = fixture(); data.matches[0].values.auto = 1.2; expect(() => parseBundle(JSON.stringify(bundle(data)))).toThrow(/whole/);
    data.matches[0].values.auto = 1; data.matches[0].values.endgame = 2; expect(() => parseBundle(JSON.stringify(bundle(data)))).toThrow(/Boolean/);
  });
});
describe('repeated and conflicting imports', () => {
  it('is idempotent and does not mutate either input', () => {
    const current = fixture(), incoming = fixture(); const original = structuredClone(current);
    const result = mergeData(current, incoming);
    expect(result.added).toBe(0); expect(result.updated).toBe(0); expect(result.skipped).toBe(1); expect(current).toEqual(original);
  });
  it('updates newer revisions and skips older ones', () => {
    const current = fixture(), incoming = fixture(); incoming.matches[0].updatedAt = '2026-01-02T12:00:00.000Z'; incoming.matches[0].notes = 'Fixed';
    expect(mergeData(current, incoming).updated).toBe(1);
    expect(mergeData(incoming, current).skipped).toBe(1);
  });
  it('refuses timestamp collisions and identity changes without changing data', () => {
    const current = fixture(), incoming = fixture(); incoming.matches[0].notes = 'Different';
    expect(() => mergeData(current, incoming)).toThrow(/timestamp/);
    incoming.matches[0].match = 2; expect(() => mergeData(current, incoming)).toThrow(/different observations/);
  });
  it('rejects changed event metric definitions', () => { const incoming = fixture(); incoming.events[0].metrics[0].weight = 9; expect(() => mergeData(fixture(), incoming)).toThrow(/definitions differ/); });
  it('does not flag equal values with a different object key order', () => {
    const data = fixture(); const other = { ...data.matches[0], id: 'second', values: { teleop: 5, endgame: 1, auto: 2 } };
    expect(conflicts([...data.matches, other]).size).toBe(0);
    other.values.auto = 9; expect(conflicts([...data.matches, other]).size).toBe(1);
  });
});
