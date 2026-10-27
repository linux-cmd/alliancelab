import type { Match, ScoutEvent } from './domain';
import { conflicts, matchKey } from './domain';

export const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export function teamStats(event: ScoutEvent, matches: Match[], team: number) {
  const rows = matches.filter(m => m.eventId === event.id && m.team === team);
  const disputed = conflicts(rows);
  const groups = new Map<number, Match[]>();
  for (const row of rows) groups.set(row.match, [...(groups.get(row.match) || []), row]);
  // Multiple observers of one match never inflate the match count.
  const clean = [...groups.values()].filter(group => !disputed.has(matchKey(group[0])));
  const scores = clean.map(group => mean(group.map(row => event.metrics.reduce((sum, m) => sum + (row.values[m.id] || 0) * m.weight, 0))));
  const byMetric = Object.fromEntries(event.metrics.map(m => [m.id, mean(clean.map(group => mean(group.map(row => row.values[m.id] || 0))))]));
  const average = mean(scores);
  return {
    team, observations: rows.length, matches: clean.length, totalMatches: groups.size, conflicts: disputed.size,
    average, spread: Math.sqrt(mean(scores.map(s => (s - average) ** 2))),
    reliability: clean.length ? mean(clean.map(group => mean(group.map(r => r.disabled ? 0 : 100)))) : 0,
    defense: mean(clean.map(group => mean(group.map(r => r.defense)))), metrics: byMetric,
    trend: clean.map((group, i) => ({ match: group[0].match, score: scores[i] })).sort((a, b) => a.match - b.match),
  };
}
export type TeamStats = ReturnType<typeof teamStats>;
export function rankTeams(event: ScoutEvent, matches: Match[], weights: Record<string, number>, reliabilityWeight: number, defenseWeight: number) {
  const stats = event.teams.map(t => ({ ...t, ...teamStats(event, matches, t.number) }));
  const max = (metric: string) => Math.max(1, ...stats.filter(s => s.matches).map(s => s.metrics[metric] || 0));
  const weightSum = event.metrics.reduce((sum, m) => sum + (weights[m.id] || 0), reliabilityWeight + defenseWeight);
  return stats.map(s => ({ ...s, rankScore: s.matches && weightSum ? 100 * (event.metrics.reduce((sum, m) => sum + ((s.metrics[m.id] || 0) / max(m.id)) * (weights[m.id] || 0), 0) + (s.reliability / 100) * reliabilityWeight + (s.defense / 5) * defenseWeight) / weightSum : 0 }))
    .sort((a, b) => b.rankScore - a.rankScore || b.matches - a.matches || a.number - b.number);
}
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function matchesCsv(event: ScoutEvent, matches: Match[]): string {
  const header = ['Event', 'Team', 'Match', 'Scout', 'Alliance', ...event.metrics.map(m => m.name), 'Disabled', 'Defense (0-5)', 'Notes', 'Record ID', 'Updated at'];
  const rows = matches.filter(m => m.eventId === event.id).map(m => [event.name, m.team, m.match, m.scout, m.alliance, ...event.metrics.map(metric => m.values[metric.id]), m.disabled, m.defense, m.notes, m.id, m.updatedAt]);
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
