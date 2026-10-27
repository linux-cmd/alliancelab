import { z } from 'zod';
export const MAX_BACKUP_BYTES = 50_000_000;

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
const short = z.string().trim().min(1).max(100);
const timestamp = z.string().datetime({ offset: true });
export const MetricSchema = z.object({
  id,
  name: short,
  phase: z.enum(['auto', 'teleop', 'endgame']),
  kind: z.enum(['count', 'rating', 'boolean']),
  weight: z.number().min(0).max(100),
});
export const TeamSchema = z.object({
  number: z.number().int().min(1).max(99999),
  name: z.string().trim().max(100),
});
export const AssignmentSchema = z.object({
  match: z.number().int().min(1).max(9999),
  team: z.number().int().min(1).max(99999),
  alliance: z.enum(['red', 'blue']),
  station: z.number().int().min(1).max(3),
});
export const EventSchema = z
  .object({
    id,
    name: short,
    location: z.string().trim().max(100),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(value + 'T12:00:00Z');
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, 'Enter a valid calendar date'),
    season: z.number().int().min(1992).max(2100),
    demo: z.boolean(),
    metrics: z.array(MetricSchema).min(1).max(12),
    teams: z.array(TeamSchema).max(500),
    schedule: z.array(AssignmentSchema).max(6000).default([]),
    updatedAt: timestamp,
  })
  .superRefine((event, ctx) => {
    if (new Set(event.metrics.map((m) => m.id)).size !== event.metrics.length)
      ctx.addIssue({ code: 'custom', message: 'Metric IDs must be unique' });
    if (new Set(event.teams.map((t) => t.number)).size !== event.teams.length)
      ctx.addIssue({ code: 'custom', message: 'Team numbers must be unique' });
    const slots = new Set<string>(),
      teams = new Set<string>();
    for (const row of event.schedule) {
      const slot = `${row.match}:${row.alliance}:${row.station}`,
        team = `${row.match}:${row.team}`;
      if (slots.has(slot) || teams.has(team))
        ctx.addIssue({
          code: 'custom',
          message: 'A match cannot repeat a team or alliance station',
        });
      if (!event.teams.some((t) => t.number === row.team))
        ctx.addIssue({
          code: 'custom',
          message: 'Every scheduled team must be on the event roster',
        });
      slots.add(slot);
      teams.add(team);
    }
  });
export const MatchSchema = z.object({
  id,
  eventId: id,
  team: z.number().int().min(1).max(99999),
  match: z.number().int().min(1).max(9999),
  scout: short,
  alliance: z.enum(['red', 'blue']),
  values: z.record(z.string().max(80), z.number().min(0).max(10000)),
  disabled: z.boolean(),
  defense: z.number().int().min(0).max(5),
  notes: z.string().max(2000),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const PitSchema = z.object({
  id,
  eventId: id,
  team: z.number().int().min(1).max(99999),
  scout: short,
  drivetrain: z.enum(['Swerve', 'Tank', 'Mecanum', 'Other', 'Unknown']),
  weight: z.number().min(0).max(1000).nullable(),
  autoNotes: z.string().max(2000),
  strengths: z.string().max(2000),
  concerns: z.string().max(2000),
  updatedAt: timestamp,
});
const DataSchema = z.object({
  events: z.array(EventSchema).max(100),
  matches: z.array(MatchSchema).max(50000),
  pits: z.array(PitSchema).max(10000),
});
export const BundleSchema = z
  .object({
    format: z.literal('alliancelab'),
    schemaVersion: z.literal(2),
    kind: z.enum(['workspace', 'event']),
    exportedAt: timestamp,
    data: DataSchema,
    localDrafts: z.record(z.string().max(240), z.unknown()).optional(),
  })
  .superRefine(({ data }, ctx) => {
    for (const [name, list] of Object.entries(data)) {
      if (new Set(list.map((x) => x.id)).size !== list.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate IDs in ' + name });
    }
    const events = new Map(data.events.map((e) => [e.id, e]));
    for (const r of [...data.matches, ...data.pits]) {
      const event = events.get(r.eventId);
      if (!event || !event.teams.some((t) => t.number === r.team)) {
        ctx.addIssue({ code: 'custom', message: 'Observation references a missing event or team' });
        continue;
      }
      if ('values' in r) {
        const keys = Object.keys(r.values);
        if (keys.length !== event.metrics.length || event.metrics.some((m) => !(m.id in r.values)))
          ctx.addIssue({ code: 'custom', message: 'Match metrics do not match the event' });
        for (const m of event.metrics) {
          const v = r.values[m.id];
          if (m.kind === 'boolean' && v !== 0 && v !== 1)
            ctx.addIssue({ code: 'custom', message: 'Boolean metrics must be 0 or 1' });
          if (m.kind === 'rating' && (v > 5 || !Number.isInteger(v)))
            ctx.addIssue({ code: 'custom', message: 'Ratings must be integers from 0 to 5' });
          if (m.kind === 'count' && !Number.isInteger(v))
            ctx.addIssue({ code: 'custom', message: 'Counts must be whole numbers' });
        }
      }
    }
  });
export type Metric = z.infer<typeof MetricSchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type ScoutEvent = z.infer<typeof EventSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type Pit = z.infer<typeof PitSchema>;
export type Data = z.infer<typeof DataSchema>;
export type Bundle = z.infer<typeof BundleSchema>;
export type Preferences = {
  selectedEvent: string;
  scout: string;
  homeTeam: string;
  station?: string;
  lastBackupAt?: string;
};
export type Workspace = { data: Data; preferences: Preferences; drafts: Record<string, unknown> };
export const emptyData = (): Data => ({ events: [], matches: [], pits: [] });
export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const defaultMetrics = (): Metric[] => [
  { id: 'auto', name: 'Auto pieces scored', phase: 'auto', kind: 'count', weight: 3 },
  { id: 'teleop', name: 'Teleop pieces scored', phase: 'teleop', kind: 'count', weight: 1 },
  { id: 'endgame', name: 'Endgame completed', phase: 'endgame', kind: 'boolean', weight: 5 },
];
export function bundle(
  data: Data,
  kind: Bundle['kind'] = 'workspace',
  localDrafts?: Workspace['drafts'],
): Bundle {
  return {
    format: 'alliancelab',
    schemaVersion: 2,
    kind,
    exportedAt: now(),
    data,
    ...(kind === 'workspace' && localDrafts ? { localDrafts } : {}),
  };
}
export function parseBundle(raw: string): Bundle {
  if (raw.length > MAX_BACKUP_BYTES || new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES)
    throw new Error('This file exceeds the 50 MB import limit.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('This is not a valid JSON backup.');
  }
  // v1 observations keep their original IDs and values; only schedules are added.
  if (value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1) {
    const old = value as { data?: { events?: unknown[] } };
    value = {
      ...value,
      schemaVersion: 2,
      data: {
        ...old.data,
        events: old.data?.events?.map((event) =>
          event && typeof event === 'object' ? { ...event, schedule: [] } : event,
        ),
      },
    };
  }
  const parsed = BundleSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      'The backup has unsupported or invalid data: ' + parsed.error.issues[0].message,
    );
  return parsed.data;
}
export const matchKey = (m: Match) => m.eventId + ':' + m.team + ':' + m.match;
export function conflicts(matches: Match[]): Set<string> {
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const key = matchKey(m);
    const group = groups.get(key);
    if (group) group.push(m);
    else groups.set(key, [m]);
  }
  return new Set(
    [...groups]
      .filter(
        ([, rows]) =>
          rows.length > 1 &&
          rows.some(
            (r) =>
              JSON.stringify(Object.entries(r.values).sort()) !==
                JSON.stringify(Object.entries(rows[0].values).sort()) ||
              r.disabled !== rows[0].disabled ||
              r.defense !== rows[0].defense,
          ),
      )
      .map(([key]) => key),
  );
}
export function mergeData(
  current: Data,
  incoming: Data,
): { data: Data; added: number; updated: number; skipped: number } {
  let added = 0,
    updated = 0,
    skipped = 0;
  const next = structuredClone(current);
  // Existing event definitions are never silently overwritten by a transfer.
  for (const event of incoming.events) {
    const existing = next.events.find((e) => e.id === event.id);
    if (existing) {
      const signature = (e: ScoutEvent) =>
        JSON.stringify(e.metrics.map((m) => [m.id, m.name, m.kind, m.phase, m.weight]));
      if (signature(existing) !== signature(event))
        throw new Error(
          'Event metric definitions differ. Import into a separate workspace or use the matching event configuration.',
        );
      for (const team of event.teams)
        if (!existing.teams.some((t) => t.number === team.number)) existing.teams.push(team);
      for (const assignment of event.schedule) {
        const same = existing.schedule.find(
          (row) => row.match === assignment.match && row.team === assignment.team,
        );
        if (same && (same.alliance !== assignment.alliance || same.station !== assignment.station))
          throw new Error(
            'Schedule assignments differ. Review the shared event setup before importing.',
          );
        if (!same) existing.schedule.push(structuredClone(assignment));
      }
    } else {
      next.events.push(structuredClone(event));
      added++;
    }
  }
  for (const name of ['matches', 'pits'] as const) {
    const target = next[name] as (Match | Pit)[];
    for (const row of incoming[name]) {
      const index = target.findIndex((r) => r.id === row.id);
      if (index < 0) {
        target.push(structuredClone(row));
        added++;
      } else {
        const old = target[index];
        if (
          old.eventId !== row.eventId ||
          old.team !== row.team ||
          ('match' in old && 'match' in row && old.match !== row.match)
        )
          throw new Error('A record ID is attached to different observations. Import canceled.');
        if (Date.parse(row.updatedAt) > Date.parse(old.updatedAt)) {
          target[index] = structuredClone(row);
          updated++;
        } else if (
          Date.parse(row.updatedAt) === Date.parse(old.updatedAt) &&
          JSON.stringify(old) !== JSON.stringify(row)
        )
          throw new Error(
            'Two different revisions share a timestamp. Import canceled; resolve the source record first.',
          );
        else skipped++;
      }
    }
  }
  const validated = BundleSchema.safeParse(bundle(next));
  if (!validated.success)
    throw new Error(
      'The merged workspace exceeds supported limits or contains invalid references.',
    );
  return { data: validated.data.data, added, updated, skipped };
}
