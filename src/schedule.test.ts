import { describe, expect, it } from 'vitest';
import { demoData } from './demo';
import { bundle, mergeData, parseBundle } from './domain';
import { nextAssignment, parseScheduleCsv } from './schedule';

const csv = 'match,team,alliance,station\n1,6901,red,1\n2,254,red,1\n2,6901,blue,1';
describe('reviewed qualification schedules', () => {
  it('accepts reordered headers, CRLF, BOM and quoted scalar values', () => {
    const event = demoData().events[0];
    expect(
      parseScheduleCsv('\uFEFFteam,station,match,alliance\r\n"6901",1,1,RED\r\n', event),
    ).toEqual([{ match: 1, team: 6901, alliance: 'red', station: 1 }]);
  });
  it('rejects malformed columns, repeated stations, repeated teams and missing roster entries', () => {
    const event = demoData().events[0];
    for (const text of [
      'a,b\n1,2',
      'match,team,alliance,station\n',
      csv + '\n2,118,red,1',
      csv + '\n2,254,blue,2',
      csv + '\n3,99999,red,1',
      csv + '\n4,6901,green,1',
    ])
      expect(() => parseScheduleCsv(text, event)).toThrow();
  });
  it('finds the next station assignment for a scout and skips saved observations', () => {
    const data = demoData(),
      event = data.events[0];
    event.schedule = parseScheduleCsv(csv, event);
    const first = nextAssignment(event, 'red-1', [], 'Alex')!;
    expect(first.match).toBe(1);
    expect(first.team).toBe(6901);
    const saved = { ...data.matches[0], match: 1, scout: 'Alex' };
    expect(nextAssignment(event, 'red-1', [saved], 'alex')?.team).toBe(254);
    expect(nextAssignment(event, 'red-1', [saved], 'Other')?.match).toBe(1);
    expect(nextAssignment(event, 'red-1', [], 'Alex', 2)).toBeUndefined();
  });
  it('migrates v1 backups and round trips v2 schedules and workspace drafts', () => {
    const data = demoData();
    const v1 = { ...bundle(data), schemaVersion: 1 };
    expect(parseBundle(JSON.stringify(v1)).data).toEqual(data);
    data.events[0].schedule = parseScheduleCsv(csv, data.events[0]);
    const value = bundle(data, 'workspace', { 'match:demo-event': { notes: 'Draft' } });
    expect(parseBundle(JSON.stringify(value))).toEqual(value);
  });
  it('merges added assignments idempotently and refuses conflicting station assignments', () => {
    const current = demoData(),
      incoming = demoData();
    incoming.events[0].schedule = parseScheduleCsv(csv, incoming.events[0]);
    const merged = mergeData(current, incoming).data;
    expect(mergeData(merged, incoming).data).toEqual(merged);
    incoming.events[0].schedule[0].station = 2;
    expect(() => mergeData(merged, incoming)).toThrow(/Schedule assignments differ/);
  });
});
