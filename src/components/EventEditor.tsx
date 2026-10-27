import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './ui';
import { defaultMetrics, EventSchema, newId, now } from '../domain';
import type { Metric, ScoutEvent } from '../domain';
import { useWorkspace } from '../context';

export default function EventEditor({ event, onClose }: { event?: ScoutEvent; onClose: () => void }) {
  const { workspace, setData, setPreferences, notify } = useWorkspace();
  const [name, setName] = useState(event?.name || '');
  const [location, setLocation] = useState(event?.location || '');
  const [date, setDate] = useState(event?.date || new Date().toISOString().slice(0, 10));
  const [season, setSeason] = useState(String(event?.season || new Date().getFullYear()));
  const [roster, setRoster] = useState(event?.teams.map(t => t.number + (t.name ? ', ' + t.name : '')).join('\n') || '');
  const [metrics, setMetrics] = useState<Metric[]>(event?.metrics || defaultMetrics());
  const [error, setError] = useState('');
  const locked = !!event && workspace.data.matches.some(m => m.eventId === event.id);
  function updateMetric(index: number, patch: Partial<Metric>) { setMetrics(old => old.map((m, i) => i === index ? { ...m, ...patch } : m)); }
  function save(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try {
      const teams = roster.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
        const match = /^(\d{1,5})(?:\s*[,;:]\s*(.*))?$/.exec(line);
        if (!match) throw new Error('Use one team per line: 6901, Knights Robotics');
        return { number: Number(match[1]), name: match[2] || '' };
      });
      if (event) {
        const used = [...workspace.data.matches, ...workspace.data.pits].filter(m => m.eventId === event.id).map(m => m.team);
        if (used.some(n => !teams.some(t => t.number === n))) throw new Error('Keep teams with existing observations in the roster.');
      }
      const parsed = EventSchema.safeParse({ id: event?.id || newId(), name, location, date, season: Number(season), teams, metrics, demo: event?.demo || false, updatedAt: now() });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const value = parsed.data;
      setData({ ...workspace.data, events: event ? workspace.data.events.map(x => x.id === event.id ? value : x) : [...workspace.data.events, value] });
      setPreferences({ selectedEvent: value.id }); notify(event ? 'Event updated.' : 'Your event is ready. Start with a match or pit observation.'); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Event could not be saved.'); }
  }
  return <Modal title={event ? 'Edit event' : 'Create an event'} onClose={onClose} wide><form onSubmit={save} className="stack">
    <p className="muted">Set up your event once, then share it with the scouting crew through a backup or QR transfer.</p>
    <div className="form-grid"><label>Event name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. North Texas Practice"/></label><label>Location<input maxLength={100} value={location} onChange={e => setLocation(e.target.value)} placeholder="Venue or city"/></label><label>Event date<input type="date" required value={date} onChange={e => setDate(e.target.value)}/></label><label>Season<input type="number" required min={1992} max={2100} value={season} onChange={e => setSeason(e.target.value)}/></label></div>
    <label>Team roster <span className="hint">One per line. You can add more teams later.</span><textarea rows={5} value={roster} onChange={e => setRoster(e.target.value)} placeholder={'6901, Knights Robotics\n254, The Cheesy Poofs\n118, Robonauts'}/></label>
    <div><div className="section-heading"><h3>Scouting metrics</h3>{!locked && metrics.length < 12 && <button type="button" className="text-button" onClick={() => setMetrics([...metrics, { id: newId(), name: '', phase: 'teleop', kind: 'count', weight: 1 }])}><Plus size={16}/>Add metric</button>}</div>
    <p className="hint">{locked ? 'Metric definitions are fixed after the first match to keep observations comparable. Create a new event for another metric setup.' : 'Choose up to 12 metrics. Weighted totals are scouting estimates, not official game scores.'}</p>
    <div className="metric-editor">{metrics.map((m, index) => <div key={m.id} className="metric-editor-row"><label>Name<input aria-label={'Metric ' + (index + 1) + ' name'} required maxLength={100} disabled={locked} value={m.name} onChange={e => updateMetric(index, { name: e.target.value })}/></label><label>Phase<select disabled={locked} value={m.phase} onChange={e => updateMetric(index, { phase: e.target.value as Metric['phase'] })}><option value="auto">Auto</option><option value="teleop">Teleop</option><option value="endgame">Endgame</option></select></label><label>Type<select disabled={locked} value={m.kind} onChange={e => updateMetric(index, { kind: e.target.value as Metric['kind'] })}><option value="count">Count</option><option value="boolean">Yes / no</option><option value="rating">Rating 0–5</option></select></label><label>Value weight<input disabled={locked} type="number" required min={0} max={100} step={0.1} value={m.weight} onChange={e => updateMetric(index, { weight: Number(e.target.value) })}/></label><button type="button" disabled={locked || metrics.length <= 1} className="icon-button" aria-label={'Remove metric ' + (index + 1)} onClick={() => setMetrics(metrics.filter((_, i) => i !== index))}><Trash2 size={16}/></button></div>)}</div></div>
    {error && <p role="alert" className="error">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit">{event ? 'Save event' : 'Create event'}</button></div>
  </form></Modal>;
}
