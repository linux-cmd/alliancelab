import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Assignment, ScoutEvent } from '../domain';
import { now } from '../domain';
import { parseScheduleCsv, scheduleTemplate } from '../schedule';
import { download } from '../storage';
import { useWorkspace } from '../context';
import { Confirm, PanelTitle } from './ui';

export default function ScheduleEditor({ event }: { event: ScoutEvent }) {
  const { workspace, setData, notify } = useWorkspace();
  const [pending, setPending] = useState<Assignment[] | null>(null);
  const [error, setError] = useState('');
  const [clear, setClear] = useState(false);
  async function file(file: File) {
    setError('');
    setPending(null);
    try {
      if (file.size > 250_000) throw new Error('Choose a schedule smaller than 250 KB.');
      setPending(parseScheduleCsv(await file.text(), event));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to read the schedule.');
    }
  }
  function save(schedule: Assignment[]) {
    if (
      !setData({
        ...workspace.data,
        events: workspace.data.events.map((item) =>
          item.id === event.id ? { ...item, schedule, updatedAt: now() } : item,
        ),
      })
    )
      return;
    setPending(null);
    notify(
      schedule.length
        ? 'Schedule saved. Choose a station on the Scout screen.'
        : 'Schedule removed.',
    );
  }
  return (
    <section className="panel">
      <PanelTitle
        title="Match schedule"
        description={
          event.schedule.length
            ? `${new Set(event.schedule.map((row) => row.match)).size} qualification matches · ${event.schedule.length} station assignments`
            : 'Optional: import a schedule to fill match details automatically.'
        }
      />
      <p className="muted">
        CSV headers: <code>match,team,alliance,station</code>. Use red or blue and station 1–3. Add
        every scheduled team to the roster first.
      </p>
      <div className="button-row">
        <label className="button secondary file-label">
          <Upload size={17} />
          Import schedule CSV
          <input
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            aria-label="Import schedule CSV"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) void file(selected);
              e.target.value = '';
            }}
          />
        </label>
        <button
          className="text-button"
          onClick={() => download(scheduleTemplate, 'alliancelab-schedule-example.csv', 'text/csv')}
        >
          <Download size={16} />
          Example CSV
        </button>
        {event.schedule.length > 0 && (
          <button className="text-button" onClick={() => setClear(true)}>
            Remove schedule
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="schedule-preview">
          <h3>Review {pending.length} assignments</h3>
          <p className="hint">
            This replaces the current schedule. Saved observations will remain.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Team</th>
                  <th>Station</th>
                </tr>
              </thead>
              <tbody>
                {pending.slice(0, 12).map((row) => (
                  <tr key={`${row.match}:${row.team}`}>
                    <td>Q{row.match}</td>
                    <td>{row.team}</td>
                    <td>
                      {row.alliance} {row.station}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pending.length > 12 && (
            <p className="hint">Showing the first 12 of {pending.length} assignments.</p>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="button primary" onClick={() => save(pending)}>
              Save schedule
            </button>
          </div>
        </div>
      )}
      {clear && (
        <Confirm
          title="Remove this schedule?"
          description="Saved observations are preserved. Match details will use manual entry."
          label="Remove schedule"
          onClose={() => setClear(false)}
          onConfirm={() => save([])}
        />
      )}
    </section>
  );
}
