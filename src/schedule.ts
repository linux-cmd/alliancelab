import { EventSchema } from './domain';
import type { Assignment, Match, ScoutEvent } from './domain';

export const scheduleTemplate =
  'match,team,alliance,station\r\n1,6901,red,1\r\n1,254,blue,1\r\n2,254,red,1\r\n2,6901,blue,1\r\n';

export function parseScheduleCsv(text: string, event: ScoutEvent): Assignment[] {
  if (text.length > 250_000) throw new Error('Choose a schedule smaller than 250 KB.');
  const lines = text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const cells = (line: string) =>
    line.split(',').map((cell) =>
      cell
        .trim()
        .replace(/^"(.*)"$/, '$1')
        .toLowerCase(),
    );
  const header = cells(lines.shift() || '');
  const required = ['match', 'team', 'alliance', 'station'];
  if (header.length !== 4 || required.some((key) => !header.includes(key)))
    throw new Error('Use these four CSV headers: match,team,alliance,station.');
  if (!lines.length) throw new Error('The schedule has no assignments.');
  const schedule = lines.map((line, index) => {
    const row = cells(line);
    if (row.length !== 4) throw new Error(`Line ${index + 2}: expected four columns.`);
    const get = (key: string) => row[header.indexOf(key)];
    if (
      !/^\d+$/.test(get('match')) ||
      !/^\d+$/.test(get('team')) ||
      !/^[1-3]$/.test(get('station')) ||
      !['red', 'blue'].includes(get('alliance'))
    )
      throw new Error(
        `Line ${index + 2}: use a match number, team number, red/blue, and station 1–3.`,
      );
    return {
      match: Number(get('match')),
      team: Number(get('team')),
      alliance: get('alliance') as Assignment['alliance'],
      station: Number(get('station')),
    };
  });
  const parsed = EventSchema.safeParse({ ...event, schedule });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data.schedule.sort(
    (a, b) => a.match - b.match || a.alliance.localeCompare(b.alliance) || a.station - b.station,
  );
}

export function nextAssignment(
  event: ScoutEvent,
  station: string,
  matches: Match[],
  scout: string,
  after = 0,
): Assignment | undefined {
  const identity = scout.trim().toLowerCase();
  const recorded = new Set(
    matches
      .filter(
        (match) => match.eventId === event.id && match.scout.trim().toLowerCase() === identity,
      )
      .map((match) => `${match.match}:${match.team}`),
  );
  let next: Assignment | undefined;
  for (const row of event.schedule) {
    if (
      `${row.alliance}-${row.station}` !== station ||
      row.match <= after ||
      recorded.has(`${row.match}:${row.team}`)
    )
      continue;
    if (!next || row.match < next.match) next = row;
  }
  return next;
}
