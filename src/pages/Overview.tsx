import { ArrowRight, ClipboardList, Plus, Download, AlertTriangle } from 'lucide-react';
import { PageHeading, Stat, PanelTitle, Tag, fmt } from '../components/ui';
import { useWorkspace } from '../context';
import { bundle, now } from '../domain';
import type { ScoutEvent } from '../domain';
import { useEventStats } from '../useEventStats';
import { download } from '../storage';
import { nextAssignment } from '../schedule';

export default function Overview({
  event,
  navigate,
  createEvent,
  exploreDemo,
}: {
  event?: ScoutEvent;
  navigate: (page: string) => void;
  createEvent: () => void;
  exploreDemo: () => void;
}) {
  if (!event)
    return (
      <section className="onboarding">
        <span className="welcome-label">OFFLINE ROBOTICS SCOUTING</span>
        <h1>A clear view of your next event.</h1>
        <p>Record what you see. Compare teams. Build your pick list.</p>
        <div className="button-row">
          <button className="button primary" onClick={createEvent}>
            <Plus size={18} />
            Create event
          </button>
          <button className="button secondary" onClick={exploreDemo}>
            Explore the demo
          </button>
        </div>
        <span className="hint">No account needed. Your data stays on your device.</span>
      </section>
    );
  return <EventOverview event={event} navigate={navigate} />;
}
function EventOverview({
  event,
  navigate,
}: {
  event: ScoutEvent;
  navigate: (page: string) => void;
}) {
  const { workspace, setPreferences } = useWorkspace();
  const summaries = useEventStats(event, workspace.data.matches);
  const rows = workspace.data.matches.filter((match) => match.eventId === event.id);
  const pits = new Set(
    workspace.data.pits.filter((pit) => pit.eventId === event.id).map((pit) => pit.team),
  );
  const covered = new Set(rows.map((match) => match.team));
  const issues = [...summaries.values()].reduce((sum, team) => sum + team.conflicts, 0);
  const ranked = event.teams
    .map((team) => ({ ...team, stats: summaries.get(team.number)! }))
    .filter((team) => team.stats.matches)
    .sort((a, b) => b.stats.average - a.stats.average);
  const recent = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const next = nextAssignment(
    event,
    workspace.preferences.station || '',
    rows,
    workspace.preferences.scout,
  );
  const backupDue =
    rows.length > 0 &&
    (!workspace.preferences.lastBackupAt ||
      Date.now() - Date.parse(workspace.preferences.lastBackupAt) > 4 * 60 * 60 * 1000);
  function backup() {
    download(
      JSON.stringify(bundle(workspace.data, 'workspace', workspace.drafts)),
      'alliancelab-backup.json',
    );
    setPreferences({ lastBackupAt: now() });
  }
  return (
    <>
      <PageHeading
        eyebrow={event.season + ' EVENT'}
        title={event.name}
        description={[
          event.location,
          new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(event.date + 'T12:00:00Z')),
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <button className="button primary" onClick={() => navigate('scout')}>
            <Plus size={18} />
            Scout a match
          </button>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Match observations"
          value={rows.length}
          detail={
            new Set(rows.map((row) => `${row.team}:${row.match}`)).size +
            ' distinct team–match pairs'
          }
        />
        <Stat
          label="Teams scouted"
          value={`${covered.size} / ${event.teams.length}`}
          detail="Teams with match observations"
        />
        <Stat
          label="Pit visits"
          value={`${pits.size} / ${event.teams.length}`}
          detail="Teams with saved pit notes"
        />
      </div>
      {issues > 0 && (
        <div className="notice amber">
          <AlertTriangle size={19} />
          <span>{issues} conflicting team–match pairs need review.</span>
          <button className="text-button" onClick={() => navigate('scout')}>
            Review observations
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {next && (
        <section className="next-match">
          <div>
            <span className="hint">YOUR NEXT ASSIGNMENT</span>
            <h2>
              Q{next.match} · Team {next.team}
            </h2>
            <p>
              {next.alliance === 'red' ? 'Red' : 'Blue'} station {next.station}
            </p>
          </div>
          <button className="button secondary" onClick={() => navigate('scout')}>
            Open scouting
            <ArrowRight size={17} />
          </button>
        </section>
      )}
      <section className="panel">
        <PanelTitle
          title="Teams at a glance"
          description="Average weighted scouting total"
          action={
            <button className="text-button" onClick={() => navigate('teams')}>
              View teams
              <ArrowRight size={16} />
            </button>
          }
        />
        {ranked.length ? (
          <div className="leaderboard">
            {ranked.slice(0, 5).map((team) => (
              <div className="leader-row" key={team.number}>
                <div className="leader-team">
                  <strong>{team.number}</strong>
                  <span>{team.name || 'Team ' + team.number}</span>
                </div>
                <span className="leader-bar">
                  <i
                    style={{
                      width:
                        Math.max(
                          1,
                          (team.stats.average / Math.max(1, ranked[0].stats.average)) * 100,
                        ) + '%',
                    }}
                  />
                </span>
                <div className="leader-score">
                  <strong>{fmt(team.stats.average)}</strong>
                  <small>{team.stats.matches} matches</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="quiet-empty">
            <ClipboardList size={28} />
            <h3>Your first observation starts here.</h3>
            <p>Record a match to see team averages and comparisons.</p>
          </div>
        )}
        <p className="hint panel-foot">
          Conflicting observations are excluded. Small samples need a closer look.
        </p>
      </section>
      {backupDue && (
        <div className="backup-reminder">
          <div>
            <strong>Keep a copy outside your browser.</strong>
            <p>Back up your observations and drafts after each session.</p>
          </div>
          <button className="button secondary" onClick={backup}>
            <Download size={17} />
            Back up now
          </button>
        </div>
      )}
      {recent.length > 0 && (
        <details className="panel optional-section">
          <summary>Recent observations</summary>
          <div className="recent-list">
            {recent.map((match) => (
              <div className="recent-row" key={match.id}>
                <span className={'match-avatar ' + match.alliance}>Q{match.match}</span>
                <div>
                  <strong>Team {match.team}</strong>
                  <span>
                    {match.scout}
                    {match.notes ? ' · ' + match.notes : ''}
                  </span>
                </div>
                <Tag>{match.disabled ? 'Disabled' : 'Recorded'}</Tag>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
