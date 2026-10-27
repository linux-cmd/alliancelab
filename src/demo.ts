import type { Data, Match, ScoutEvent } from './domain';
import { defaultMetrics } from './domain';

export function demoData(): Data {
  const date = new Date().toISOString().slice(0, 10);
  const stamp = '2026-01-01T12:00:00.000Z';
  const event: ScoutEvent = { id: 'demo-event', name: 'Lone Star Practice', location: 'Demo field · fictional observations', date, season: new Date().getFullYear(), demo: true, updatedAt: stamp, metrics: defaultMetrics(),
    teams: [{ number: 6901, name: 'Knights Robotics' }, { number: 254, name: 'The Cheesy Poofs' }, { number: 118, name: 'Robonauts' }, { number: 148, name: 'Robowranglers' }, { number: 2056, name: 'OP Robotics' }, { number: 1678, name: 'Citrus Circuits' }, { number: 3310, name: 'Black Hawk Robotics' }, { number: 3005, name: 'RoboChargers' }] };
  const matches: Match[] = [];
  event.teams.forEach((team, ti) => {
    for (let n = 1; n <= (ti === 7 ? 2 : 4); n++) {
      matches.push({ id: 'demo-' + team.number + '-' + n, eventId: event.id, team: team.number, match: n * 3 + ti, scout: ['Alex', 'Jordan', 'Sam'][ti % 3], alliance: n % 2 ? 'red' : 'blue',
        values: { auto: Math.max(0, [3, 5, 4, 4, 3, 5, 3, 2][ti] + (n % 3 - 1)), teleop: [10, 17, 15, 14, 12, 16, 11, 9][ti] + ((n * 3 + ti) % 5), endgame: n === 2 && ti % 3 === 0 ? 0 : 1 },
        disabled: ti === 4 && n === 3, defense: [4, 3, 4, 5, 3, 4, 5, 2][ti],
        notes: n === 4 ? 'Consistent cycles. Check autonomous starting position before the next match.' : '', createdAt: stamp, updatedAt: stamp });
    }
  });
  return { events: [event], matches, pits: event.teams.slice(0, 6).map(t => ({ id: 'demo-pit-' + t.number, eventId: event.id, team: t.number, scout: 'Jordan', drivetrain: 'Swerve', weight: 115, autoNotes: 'Multiple starting positions available; confirm route with drive team.', strengths: 'Fast intake and dependable field navigation.', concerns: 'Allow time for battery swaps.', updatedAt: stamp })) };
}
