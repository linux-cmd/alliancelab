import { useState } from 'react';
import { z } from 'zod';
import { Plus, Minus, Save, Search, Pencil, Trash2, Check } from 'lucide-react';
import { useWorkspace } from '../context';
import { MatchSchema, PitSchema, newId, now, matchKey, conflicts } from '../domain';
import type { Match, Pit, ScoutEvent } from '../domain';
import { nextAssignment } from '../schedule';
import { PageHeading, PanelTitle, Tag, Empty, Confirm, fmt } from '../components/ui';

const DraftSchema = MatchSchema.extend({ scout: z.string().max(100) });
const PitDraftSchema = PitSchema.extend({ scout: z.string().max(100) });
function freshMatch(event: ScoutEvent, scout: string): Match {
  return {
    id: newId(),
    eventId: event.id,
    team: event.teams[0]?.number || 0,
    match: 1,
    scout,
    alliance: 'red',
    values: Object.fromEntries(event.metrics.map((metric) => [metric.id, 0])),
    disabled: false,
    defense: 0,
    notes: '',
    createdAt: now(),
    updatedAt: now(),
  };
}
function matchesMetrics(form: Match, event: ScoutEvent) {
  return (
    Object.keys(form.values).length === event.metrics.length &&
    event.metrics.every((metric) => {
      const value = form.values[metric.id];
      return (
        Number.isInteger(value) &&
        value >= 0 &&
        (metric.kind === 'boolean'
          ? value <= 1
          : metric.kind === 'rating'
            ? value <= 5
            : value <= 10000)
      );
    })
  );
}

export default function Scout({ event }: { event: ScoutEvent }) {
  const { workspace, setData, setPreferences, setDraft, clearDraft, notify } = useWorkspace();
  const [tab, setTab] = useState<'match' | 'pit'>('match');
  const [editing, setEditing] = useState<string | null>(null);
  function loadDraft(key: string, fallback: Match) {
    const draft = DraftSchema.safeParse(workspace.drafts[key]);
    return draft.success &&
      draft.data.eventId === event.id &&
      event.teams.some((team) => team.number === draft.data.team)
      ? draft.data
      : fallback;
  }
  const [form, setForm] = useState<Match>(() =>
    loadDraft('match:' + event.id, freshMatch(event, workspace.preferences.scout)),
  );
  const [station, setStation] = useState(workspace.preferences.station || '');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const [deleting, setDeleting] = useState<Match | null>(null);
  const [discard, setDiscard] = useState(false);
  const rows = workspace.data.matches.filter((match) => match.eventId === event.id);
  const disputes = conflicts(rows);
  const draftKey = editing ? `edit:${event.id}:${editing}` : `match:${event.id}`;
  const compatible = matchesMetrics(form, event);
  function update(patch: Partial<Match>) {
    const next = { ...form, ...patch };
    if (!setDraft(draftKey, next)) {
      setError(
        'This draft would exceed the backup limit. Export and archive an older event first.',
      );
      return;
    }
    setForm(next);
    setError('');
  }
  function value(metric: string, number: number, max = 10000) {
    if (Number.isFinite(number))
      update({
        values: { ...form.values, [metric]: Math.max(0, Math.min(max, Math.floor(number))) },
      });
  }
  function reset() {
    clearDraft(draftKey);
    setForm(
      editing
        ? loadDraft('match:' + event.id, freshMatch(event, workspace.preferences.scout))
        : freshMatch(event, workspace.preferences.scout),
    );
    setEditing(null);
    setError('');
  }
  function chooseStation(value: string) {
    setStation(value);
    setPreferences({ station: value });
    const next = nextAssignment(event, value, rows, form.scout);
    if (next) update({ match: next.match, team: next.team, alliance: next.alliance });
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!compatible) {
      setError(
        'The event metrics changed. Update this draft to the current metrics before saving.',
      );
      return;
    }
    const result = MatchSchema.safeParse({ ...form, scout: form.scout.trim(), updatedAt: now() });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (!event.teams.some((team) => team.number === form.team)) {
      setError('Choose a team from the event roster.');
      return;
    }
    if (
      rows.some(
        (row) =>
          row.id !== editing &&
          row.team === form.team &&
          row.match === form.match &&
          row.scout.toLowerCase() === form.scout.trim().toLowerCase(),
      )
    ) {
      setError(
        'This scout already recorded this team and match. Edit it in the saved observations below.',
      );
      return;
    }
    const record = result.data;
    const next = nextAssignment(event, station, [...rows, record], record.scout, record.match);
    const nextForm = editing
      ? loadDraft('match:' + event.id, freshMatch(event, record.scout))
      : {
          ...freshMatch(event, record.scout),
          team: next?.team || record.team,
          match: next?.match || Math.min(9999, record.match + 1),
          alliance: next?.alliance || record.alliance,
        };
    const nextDrafts = { ...workspace.drafts };
    delete nextDrafts[draftKey];
    nextDrafts['match:' + event.id] = nextForm;
    if (
      !setData(
        {
          ...workspace.data,
          matches: editing
            ? workspace.data.matches.map((match) => (match.id === editing ? record : match))
            : [...workspace.data.matches, record],
        },
        nextDrafts,
      )
    ) {
      setError(
        'The observation was not saved. Your draft is still here. Check the workspace notice.',
      );
      return;
    }
    setPreferences({ scout: record.scout });
    notify(
      editing ? 'Observation updated.' : `Match Q${record.match} saved for team ${record.team}.`,
    );
    setForm(nextForm);
    setEditing(null);
    setError('');
  }
  function edit(record: Match) {
    setEditing(record.id);
    setForm(loadDraft(`edit:${event.id}:${record.id}`, structuredClone(record)));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const filtered = [...rows]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((match) =>
      [match.team, 'Q' + match.match, match.scout, match.notes]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  return (
    <>
      <PageHeading
        eyebrow=""
        title="Scout"
        description="Record a match or visit a team in the pits."
      />
      <div className="tab-bar" aria-label="Observation type">
        <button className={tab === 'match' ? 'active' : ''} onClick={() => setTab('match')}>
          Match scouting
        </button>
        <button className={tab === 'pit' ? 'active' : ''} onClick={() => setTab('pit')}>
          Pit scouting
        </button>
      </div>
      {tab === 'pit' ? (
        <PitForm event={event} />
      ) : !event.teams.length ? (
        <section className="panel">
          <Empty title="Add teams to begin">Add your roster in Manage → Event settings.</Empty>
        </section>
      ) : (
        <>
          <form className="scout-layout" onSubmit={save}>
            {event.schedule.length > 0 && !editing && (
              <section className="panel queue-panel">
                <div>
                  <h2>Match queue</h2>
                  <p>Choose your assigned station to fill in the next match.</p>
                </div>
                <label>
                  Scouting station
                  <select
                    aria-label="Scouting station"
                    value={station}
                    onChange={(e) => chooseStation(e.target.value)}
                  >
                    <option value="">Manual entry</option>
                    {['red', 'blue'].flatMap((alliance) =>
                      [1, 2, 3].map((number) => (
                        <option key={`${alliance}-${number}`} value={`${alliance}-${number}`}>
                          {alliance === 'red' ? 'Red' : 'Blue'} {number}
                        </option>
                      )),
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  className="button secondary"
                  disabled={!nextAssignment(event, station, rows, form.scout)}
                  onClick={() => {
                    const next = nextAssignment(event, station, rows, form.scout);
                    if (next)
                      update({ match: next.match, team: next.team, alliance: next.alliance });
                  }}
                >
                  Next unscouted match
                </button>
              </section>
            )}
            <section className="panel">
              <PanelTitle
                title={editing ? 'Edit observation' : 'Match details'}
                action={
                  <Tag>{editing ? 'Edits kept as a draft' : 'Draft kept on this device'}</Tag>
                }
              />
              <div className="form-grid match-details">
                <label>
                  Team
                  <select
                    aria-label="Match team"
                    required
                    value={form.team}
                    onChange={(e) => update({ team: Number(e.target.value) })}
                  >
                    {event.teams.map((team) => (
                      <option key={team.number} value={team.number}>
                        {team.number} · {team.name || 'Team ' + team.number}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Qualification match
                  <input
                    required
                    type="number"
                    min={1}
                    max={9999}
                    value={form.match}
                    onChange={(e) => update({ match: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Scout name
                  <input
                    required
                    maxLength={100}
                    autoComplete="nickname"
                    value={form.scout}
                    onChange={(e) => update({ scout: e.target.value })}
                    placeholder="Your name"
                  />
                </label>
                <fieldset className="field">
                  <legend>Alliance</legend>
                  <div className="segmented">
                    {(['red', 'blue'] as const).map((alliance) => (
                      <button
                        key={alliance}
                        type="button"
                        aria-pressed={form.alliance === alliance}
                        className={form.alliance === alliance ? alliance + ' selected' : ''}
                        onClick={() => update({ alliance })}
                      >
                        {alliance === 'red' ? 'Red' : 'Blue'}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>
            {!compatible && (
              <div className="notice amber">
                <div>
                  <strong>The event metrics changed.</strong>
                  <p>
                    Your original draft is preserved until you update it. Values will be matched by
                    metric ID and adjusted to the new type.
                  </p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(form, null, 2)], {
                          type: 'application/json',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'alliancelab-original-draft.json';
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }}
                    >
                      Download original draft
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        update({
                          values: Object.fromEntries(
                            event.metrics.map((metric) => [
                              metric.id,
                              Math.min(
                                metric.kind === 'boolean'
                                  ? 1
                                  : metric.kind === 'rating'
                                    ? 5
                                    : 10000,
                                Math.max(0, Math.floor(form.values[metric.id] || 0)),
                              ),
                            ]),
                          ),
                        })
                      }
                    >
                      Update draft metrics
                    </button>
                  </div>
                </div>
              </div>
            )}
            <section className="panel metric-panel">
              {(['auto', 'teleop', 'endgame'] as const)
                .filter((phase) => event.metrics.some((metric) => metric.phase === phase))
                .map((phase) => (
                  <div className="phase-section" key={phase}>
                    <h2>
                      {{ auto: 'Autonomous', teleop: 'Teleoperated', endgame: 'Endgame' }[phase]}
                    </h2>
                    <div className="metric-inputs">
                      {event.metrics
                        .filter((metric) => metric.phase === phase)
                        .map((metric) => (
                          <div className="metric-input" key={metric.id}>
                            <label htmlFor={'metric-' + metric.id}>{metric.name}</label>
                            {metric.kind === 'boolean' ? (
                              <button
                                id={'metric-' + metric.id}
                                type="button"
                                className={'toggle-answer ' + (form.values[metric.id] ? 'yes' : '')}
                                aria-pressed={!!form.values[metric.id]}
                                onClick={() => value(metric.id, form.values[metric.id] ? 0 : 1, 1)}
                              >
                                {form.values[metric.id] ? (
                                  <>
                                    <Check size={18} />
                                    Yes
                                  </>
                                ) : (
                                  'No'
                                )}
                              </button>
                            ) : (
                              <div className="stepper">
                                <button
                                  type="button"
                                  aria-label={'Decrease ' + metric.name}
                                  onClick={() =>
                                    value(
                                      metric.id,
                                      (form.values[metric.id] || 0) - 1,
                                      metric.kind === 'rating' ? 5 : 10000,
                                    )
                                  }
                                  disabled={!form.values[metric.id]}
                                >
                                  <Minus size={18} />
                                </button>
                                <input
                                  id={'metric-' + metric.id}
                                  aria-label={metric.name}
                                  type="number"
                                  min={0}
                                  max={metric.kind === 'rating' ? 5 : 10000}
                                  value={form.values[metric.id] ?? 0}
                                  onChange={(e) =>
                                    value(
                                      metric.id,
                                      Number(e.target.value),
                                      metric.kind === 'rating' ? 5 : 10000,
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  aria-label={'Increase ' + metric.name}
                                  onClick={() =>
                                    value(
                                      metric.id,
                                      (form.values[metric.id] || 0) + 1,
                                      metric.kind === 'rating' ? 5 : 10000,
                                    )
                                  }
                                >
                                  <Plus size={18} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </section>
            <details className="panel optional-section">
              <summary>Notes, defense & reliability</summary>
              <div className="stack">
                <fieldset>
                  <legend>Defense effectiveness</legend>
                  <p className="hint">0 = not observed · 1 = limited · 5 = excellent</p>
                  <div className="rating-buttons">
                    {[0, 1, 2, 3, 4, 5].map((number) => (
                      <button
                        type="button"
                        key={number}
                        aria-label={'Defense rating ' + number}
                        aria-pressed={form.defense === number}
                        className={form.defense === number ? 'selected' : ''}
                        onClick={() => update({ defense: number })}
                      >
                        {number}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.disabled}
                    onChange={(e) => update({ disabled: e.target.checked })}
                  />
                  Robot was disabled or stopped functioning
                </label>
                <label>
                  Match notes
                  <textarea
                    aria-label="Match notes"
                    maxLength={2000}
                    rows={3}
                    value={form.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                    placeholder="What should the drive team know?"
                  />
                </label>
              </div>
            </details>
            <div className="save-bar">
              <div>
                <strong>
                  {fmt(
                    event.metrics.reduce(
                      (sum, metric) => sum + (form.values[metric.id] || 0) * metric.weight,
                      0,
                    ),
                  )}
                </strong>
                <span>scouting total</span>
              </div>
              <button className="button ghost" type="button" onClick={() => setDiscard(true)}>
                {editing ? 'Cancel editing' : 'Clear draft'}
              </button>
              <button className="button primary" type="submit">
                <Save size={18} />
                {editing ? 'Save changes' : 'Save observation'}
              </button>
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <p className="hint">Totals use your event’s weights. They are scouting estimates.</p>
          </form>
          <details className="panel match-log optional-section">
            <summary>
              Saved observations <span className="summary-count">{rows.length}</span>
            </summary>
            <div className="log-content">
              <label className="search-field">
                <Search size={18} />
                <input
                  aria-label="Search observations"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(30);
                  }}
                  placeholder="Team, match, scout…"
                />
              </label>
              {filtered.length ? (
                <>
                  <div className="mobile-match-log">
                    {filtered.slice(0, limit).map((match) => (
                      <article key={match.id} className="mobile-match-card">
                        <div>
                          <span className={'match-avatar ' + match.alliance}>Q{match.match}</span>
                          <span>
                            <strong>Team {match.team}</strong>
                            <small>{match.scout}</small>
                          </span>
                          <Tag tone={disputes.has(matchKey(match)) ? 'amber' : ''}>
                            {disputes.has(matchKey(match)) ? 'Review' : 'Recorded'}
                          </Tag>
                        </div>
                        <div className="mobile-match-actions">
                          <button
                            className="button secondary"
                            aria-label={`Edit team ${match.team} match ${match.match}`}
                            onClick={() => edit(match)}
                          >
                            <Pencil size={16} />
                            Edit
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete team ${match.team} match ${match.match}`}
                            onClick={() => setDeleting(match)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Match</th>
                          <th>Team</th>
                          <th>Scout</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, limit).map((match) => (
                          <tr key={match.id}>
                            <td>Q{match.match}</td>
                            <td>
                              <strong>{match.team}</strong>
                            </td>
                            <td>{match.scout}</td>
                            <td>
                              {fmt(
                                event.metrics.reduce(
                                  (sum, metric) =>
                                    sum + (match.values[metric.id] || 0) * metric.weight,
                                  0,
                                ),
                              )}
                            </td>
                            <td>
                              {disputes.has(matchKey(match)) ? (
                                <Tag tone="amber">Needs review</Tag>
                              ) : match.disabled ? (
                                <Tag tone="amber">Disabled</Tag>
                              ) : (
                                'Recorded'
                              )}
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`Edit team ${match.team} match ${match.match}`}
                                  onClick={() => edit(match)}
                                >
                                  <Pencil size={18} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Delete team ${match.team} match ${match.match}`}
                                  onClick={() => setDeleting(match)}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {limit < filtered.length && (
                    <button className="button secondary" onClick={() => setLimit(limit + 30)}>
                      Show more
                    </button>
                  )}
                </>
              ) : (
                <Empty title="No observations yet">Saved matches appear here for review.</Empty>
              )}
            </div>
          </details>
        </>
      )}
      {deleting && (
        <Confirm
          title="Delete this observation?"
          description={`Team ${deleting.team} · Qualification ${deleting.match}. Keep a backup if you need this later.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            if (
              setData({
                ...workspace.data,
                matches: workspace.data.matches.filter((match) => match.id !== deleting.id),
              })
            ) {
              if (editing === deleting.id) reset();
              notify('Observation deleted.');
            }
          }}
        />
      )}
      {discard && (
        <Confirm
          title={editing ? 'Discard these edits?' : 'Clear this draft?'}
          description="Saved observations will remain."
          label="Discard draft"
          onClose={() => setDiscard(false)}
          onConfirm={reset}
        />
      )}
    </>
  );
}

function PitForm({ event }: { event: ScoutEvent }) {
  const { workspace, setData, setPreferences, setDraft, notify } = useWorkspace();
  function load(team: number): Pit {
    const draft = PitDraftSchema.safeParse(workspace.drafts[`pit:${event.id}:${team}`]);
    if (draft.success && draft.data.eventId === event.id && draft.data.team === team)
      return draft.data;
    const latest = workspace.data.pits
      .filter((pit) => pit.eventId === event.id && pit.team === team)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return structuredClone(
      latest || {
        id: newId(),
        eventId: event.id,
        team,
        scout: workspace.preferences.scout,
        drivetrain: 'Unknown',
        weight: null,
        autoNotes: '',
        strengths: '',
        concerns: '',
        updatedAt: now(),
      },
    );
  }
  const [form, setForm] = useState<Pit>(() => load(event.teams[0]?.number || 0));
  const [error, setError] = useState('');
  function update(patch: Partial<Pit>) {
    const next = { ...form, ...patch };
    if (!setDraft(`pit:${event.id}:${form.team}`, next)) {
      setError(
        'This draft would exceed the backup limit. Export and archive an older event first.',
      );
      return;
    }
    setForm(next);
    setError('');
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    const result = PitSchema.safeParse({ ...form, scout: form.scout.trim(), updatedAt: now() });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    const record = result.data;
    const nextDrafts = { ...workspace.drafts };
    delete nextDrafts[`pit:${event.id}:${record.team}`];
    if (
      !setData(
        {
          ...workspace.data,
          pits: workspace.data.pits.some((pit) => pit.id === record.id)
            ? workspace.data.pits.map((pit) => (pit.id === record.id ? record : pit))
            : [...workspace.data.pits, record],
        },
        nextDrafts,
      )
    ) {
      setError('Unable to save. Your pit draft is preserved.');
      return;
    }
    setForm(record);
    setPreferences({ scout: record.scout });
    notify('Pit notes saved for team ' + record.team + '.');
  }
  if (!event.teams.length)
    return (
      <section className="panel">
        <Empty title="Add teams to begin">Add a roster in Event settings.</Empty>
      </section>
    );
  return (
    <form onSubmit={save} className="panel pit-form">
      <PanelTitle
        title="Pit notes"
        description="Drafts are kept separately for each team. Save to add them to team insights."
      />
      <div className="stack">
        <div className="form-grid">
          <label>
            Team
            <select
              aria-label="Pit team"
              value={form.team}
              onChange={(e) => {
                setForm(load(Number(e.target.value)));
                setError('');
              }}
            >
              {event.teams.map((team) => (
                <option key={team.number} value={team.number}>
                  {team.number} · {team.name || 'Team ' + team.number}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scout name
            <input
              required
              maxLength={100}
              value={form.scout}
              onChange={(e) => update({ scout: e.target.value })}
            />
          </label>
          <label>
            Drivetrain
            <select
              aria-label="Drivetrain"
              value={form.drivetrain}
              onChange={(e) => update({ drivetrain: e.target.value as Pit['drivetrain'] })}
            >
              {['Unknown', 'Swerve', 'Tank', 'Mecanum', 'Other'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Robot weight (lb, optional)
            <input
              type="number"
              min={0}
              max={1000}
              step={0.1}
              value={form.weight ?? ''}
              onChange={(e) =>
                update({ weight: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Autonomous capabilities
          <textarea
            aria-label="Autonomous capabilities"
            maxLength={2000}
            rows={3}
            value={form.autoNotes}
            onChange={(e) => update({ autoNotes: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Strengths
            <textarea
              aria-label="Strengths"
              maxLength={2000}
              rows={4}
              value={form.strengths}
              onChange={(e) => update({ strengths: e.target.value })}
            />
          </label>
          <label>
            Concerns or questions
            <textarea
              aria-label="Concerns or questions"
              maxLength={2000}
              rows={4}
              value={form.concerns}
              onChange={(e) => update({ concerns: e.target.value })}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button primary" type="submit">
            <Save size={18} />
            Save pit notes
          </button>
        </div>
      </div>
    </form>
  );
}
