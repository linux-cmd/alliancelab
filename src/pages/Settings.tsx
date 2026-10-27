import { useState } from 'react';
import { version } from '../../package.json';
import { Plus, Pencil, Trash2, Download, ExternalLink } from 'lucide-react';
import { useWorkspace } from '../context';
import type { ScoutEvent } from '../domain';
import { bundle, now } from '../domain';
import { PageHeading, PanelTitle, Tag, Confirm } from '../components/ui';
import EventEditor from '../components/EventEditor';
import ScheduleEditor from '../components/ScheduleEditor';
import { demoData } from '../demo';
import { download, previousBackup } from '../storage';

export default function Settings({ createEvent }: { createEvent: () => void }) {
  const { workspace, setData, setPreferences, notify } = useWorkspace();
  const [editing, setEditing] = useState<ScoutEvent | null>(null);
  const [deleting, setDeleting] = useState<ScoutEvent | null>(null);
  const [clear, setClear] = useState(false);
  const [scout, setScout] = useState(workspace.preferences.scout);
  const [homeTeam, setHomeTeam] = useState(workspace.preferences.homeTeam);
  const event =
    workspace.data.events.find((item) => item.id === workspace.preferences.selectedEvent) ||
    workspace.data.events[0];
  function demo() {
    const example = demoData();
    if (
      !workspace.data.events.some((item) => item.id === 'demo-event') &&
      !setData({
        events: [...workspace.data.events, ...example.events],
        matches: [...workspace.data.matches, ...example.matches],
        pits: [...workspace.data.pits, ...example.pits],
      })
    )
      return;
    setPreferences({ selectedEvent: 'demo-event' });
    notify('Demo event opened. All observations are fictional.');
  }
  function backup() {
    download(
      JSON.stringify(bundle(workspace.data, 'workspace', workspace.drafts)),
      'alliancelab-backup.json',
    );
    setPreferences({ lastBackupAt: now() });
    notify('Workspace backup downloaded.');
  }
  async function recoveryCopy() {
    try {
      const raw = await previousBackup();
      if (!raw) {
        notify('No previous snapshot yet. A snapshot is kept when saved scouting data changes.');
        return;
      }
      download(raw, 'alliancelab-previous-snapshot.json');
      notify('Previous snapshot downloaded. Review it in Backups & sharing.');
    } catch {
      notify('The previous snapshot could not be read. Download your current backup.');
    }
  }
  return (
    <>
      <PageHeading
        eyebrow=""
        title="Event settings"
        description="Set up your crew, roster, and match schedule."
      />
      <section className="panel">
        <PanelTitle
          title="Scouting profile"
          description="The starting name for new observations."
        />
        <form
          className="profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            setPreferences({ scout: scout.trim(), homeTeam });
            notify('Scouting profile saved.');
          }}
        >
          <label>
            Scout name
            <input
              maxLength={100}
              value={scout}
              onChange={(e) => setScout(e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label>
            Home team (optional)
            <input
              type="number"
              min={1}
              max={99999}
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
            />
          </label>
          <button className="button primary" type="submit">
            Save profile
          </button>
        </form>
      </section>
      <section className="panel">
        <PanelTitle
          title="Events"
          action={
            <button className="button secondary" onClick={createEvent}>
              <Plus size={17} />
              Create event
            </button>
          }
        />
        {workspace.data.events.length ? (
          <div className="event-list">
            {workspace.data.events.map((item) => (
              <div key={item.id}>
                <div className="event-list-name">
                  <strong>{item.name}</strong>
                  <span>
                    {item.season} · {item.teams.length} teams
                  </span>
                </div>
                {item.demo && <Tag>Demo</Tag>}
                {event?.id === item.id && <Tag tone="green">Active</Tag>}
                <button
                  className="icon-button"
                  aria-label={'Edit event ' + item.name}
                  onClick={() => setEditing(item)}
                >
                  <Pencil size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label={'Delete event ' + item.name}
                  onClick={() => setDeleting(item)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Create an event to start scouting.</p>
        )}
      </section>
      {event && <ScheduleEditor key={event.id} event={event} />}
      <details className="panel optional-section">
        <summary>Storage & recovery</summary>
        <div className="stack">
          <p>
            Your workspace is saved in this browser’s IndexedDB. Clearing site data or using private
            browsing can remove it. A previous snapshot is kept when saved scouting data changes; it
            shares the same browser storage, so keep an external backup too.
          </p>
          <p className="hint">
            Existing v1 localStorage data is migrated automatically and the original copy is
            retained. Both v1 and v2 JSON backups can be imported.
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={backup}>
              <Download size={17} />
              Download backup
            </button>
            <button className="button secondary" onClick={() => void recoveryCopy()}>
              Download previous snapshot
            </button>
          </div>
        </div>
      </details>
      <details className="panel optional-section">
        <summary>About, privacy & demo</summary>
        <div className="stack">
          <p>
            AllianceLab is created and maintained by <strong>Abhijay Panwar</strong>. It stores data
            locally and processes camera frames on your device. It has no accounts, telemetry, or
            scouting backend. Backups contain scout names, notes, and local drafts.
          </p>
          <p className="hint">
            An independent community project, not affiliated with or endorsed by FIRST. FIRST and
            FRC are trademarks of FIRST.
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={demo}>
              Open demo event
            </button>
            <a
              className="text-button"
              href="https://github.com/linux-cmd/alliancelab"
              target="_blank"
              rel="noreferrer"
            >
              View source
              <ExternalLink size={16} />
            </a>
            <span className="hint">v{version}</span>
          </div>
        </div>
      </details>
      <details className="panel optional-section danger-zone">
        <summary>Reset workspace</summary>
        <div className="stack">
          <p>
            Delete events, observations, and drafts from the current workspace. Export a backup
            before continuing. A retained v1 migration copy is separate from this reset.
          </p>
          <button className="button danger-outline" onClick={() => setClear(true)}>
            <Trash2 size={17} />
            Reset workspace
          </button>
        </div>
      </details>
      {editing && <EventEditor event={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm
          title={'Delete ' + deleting.name + '?'}
          description="This removes its observations, schedule, and drafts. Export a backup first if you need them."
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.id;
            if (
              setData({
                events: workspace.data.events.filter((item) => item.id !== id),
                matches: workspace.data.matches.filter((match) => match.eventId !== id),
                pits: workspace.data.pits.filter((pit) => pit.eventId !== id),
              })
            )
              notify('Event deleted from this device.');
          }}
        />
      )}
      {clear && (
        <Confirm
          title="Reset every event on this device?"
          description="All current events and observations will be removed. Export a backup first."
          label="Reset workspace"
          onClose={() => setClear(false)}
          onConfirm={() => {
            if (setData({ events: [], matches: [], pits: [] })) {
              setPreferences({ selectedEvent: '' });
              notify('Workspace reset.');
            }
          }}
        />
      )}
    </>
  );
}
