import { useState } from 'react';
import { Plus, Pencil, Trash2, Download, ShieldCheck, ExternalLink, FlaskConical, HardDrive } from 'lucide-react';
import { useWorkspace } from '../context';
import type { ScoutEvent } from '../domain';
import { PageHeading, PanelTitle, Tag, Confirm } from '../components/ui';
import EventEditor from '../components/EventEditor';
import { demoData } from '../demo';
import { bundle } from '../domain';
import { download } from '../storage';

export default function Settings({ createEvent }: { createEvent: () => void }) {
  const { workspace, setData, setPreferences, notify } = useWorkspace();
  const [editing, setEditing] = useState<ScoutEvent | null>(null);
  const [deleting, setDeleting] = useState<ScoutEvent | null>(null);
  const [clear, setClear] = useState(false);
  const [scout, setScout] = useState(workspace.preferences.scout);
  const [homeTeam, setHomeTeam] = useState(workspace.preferences.homeTeam);
  const [saved, setSaved] = useState(false);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number } | null>(null);
  async function storageEstimate() {
    if (navigator.storage?.estimate) setStorage(await navigator.storage.estimate());
    else notify('Storage estimates are unavailable in this browser. Keep a JSON backup.');
  }
  function demo() {
    const example = demoData();
    if (!workspace.data.events.some(e => e.id === 'demo-event')) setData({ events: [...workspace.data.events, ...example.events], matches: [...workspace.data.matches, ...example.matches], pits: [...workspace.data.pits, ...example.pits] });
    setPreferences({ selectedEvent: 'demo-event' }); notify('Demo event opened. All demo observations are fictional.');
  }
  return <>
    <PageHeading eyebrow="MAKE IT YOURS" title="A workspace that fits your crew." description="Manage your events, set your scouting identity, and keep your data in your hands." action={<Tag>v1.0.0</Tag>}/>
    <section className="panel"><PanelTitle title="Your scouting identity" description="Used as the starting scout name for new observations."/><form className="profile-form" onSubmit={e => { e.preventDefault(); setPreferences({ scout: scout.trim(), homeTeam }); setSaved(true); notify('Scouting profile saved.'); }}><label>Scout name<input maxLength={100} value={scout} onChange={e => { setScout(e.target.value); setSaved(false); }} placeholder="Abhijay"/></label><label>Home team (optional)<input type="number" min={1} max={99999} value={homeTeam} onChange={e => { setHomeTeam(e.target.value); setSaved(false); }} placeholder="6901"/></label><button className="button primary" type="submit">{saved ? 'Profile saved' : 'Save profile'}</button></form></section>
    <section className="panel"><PanelTitle title="Your events" description="Each event has its own roster, metrics, and observations." action={<button className="button secondary" onClick={createEvent}><Plus size={16}/>Create event</button>}/>{workspace.data.events.length ? <div className="event-list">{workspace.data.events.map(e => <div key={e.id}><div className="event-initial">{e.demo ? <FlaskConical size={20}/> : e.name.slice(0, 1)}</div><div className="event-list-name"><strong>{e.name}</strong><span>{e.season} · {e.teams.length} teams · {workspace.data.matches.filter(m => m.eventId === e.id).length} observations</span></div>{e.demo && <Tag tone="amber">Demo</Tag>}{workspace.preferences.selectedEvent === e.id && <Tag tone="green">Active</Tag>}<button className="icon-button" aria-label={'Edit event ' + e.name} onClick={() => setEditing(e)}><Pencil size={16}/></button><button className="icon-button" aria-label={'Delete event ' + e.name} onClick={() => setDeleting(e)}><Trash2 size={16}/></button></div>)}</div> : <p className="muted">No events yet. Create one to start scouting, or explore the demo.</p>}</section>
    <div className="transfer-cards"><section className="panel"><PanelTitle title="A practice field for the app" description="Explore the workflow with a separate demo event."/><p className="muted">The demo uses fictional observations and real team names. It is labeled throughout the app and kept separate from your actual events.</p><button className="button secondary" onClick={demo}><FlaskConical size={16}/>Open demo event</button></section><section className="panel"><PanelTitle title="Local by design" description="No accounts. No analytics. No uploads."/><p className="muted">Scouting data, preferences, and match drafts are stored in this browser on this device. Clearing site data or using private browsing can remove them. Back up after every session.</p><button className="button secondary" onClick={() => { download(JSON.stringify(bundle(workspace.data), null, 2), 'alliancelab-backup.json'); notify('Workspace backup downloaded.'); }}><Download size={16}/>Download backup</button></section></div>
    <section className="panel"><PanelTitle title="Storage & privacy" action={<ShieldCheck size={22}/>}/><div className="privacy-grid"><div><h3>Keep a copy you control.</h3><p>Backups include names and free-text notes. Share them only with people who should have access. Data is stored locally without encryption; someone with access to your browser profile can read it.</p><p>Camera scanning happens on your device. AllianceLab does not send camera frames or scouting data to a service. Hosting providers may receive ordinary web requests.</p></div><div><h3>Browser storage</h3><p>Data is saved in localStorage. The app shell is cached separately for offline use. Install the app or bookmark it, then verify an offline reload before your event.</p><button className="text-button" onClick={() => void storageEstimate()}><HardDrive size={15}/>Check origin storage estimate</button>{storage && <p className="hint">{storage.usage !== undefined ? (storage.usage / 1_000_000).toFixed(1) + ' MB used' : 'Usage unavailable'} · {storage.quota ? (storage.quota / 1_000_000).toFixed(0) + ' MB origin estimate' : 'Quota unavailable'}. This estimate covers the origin and is not a guarantee of localStorage capacity.</p>}</div></div></section>
    <section className="panel about-panel"><div><h2>AllianceLab</h2><p>Scouting, together. Created and maintained by <strong>Abhijay Panwar</strong>.</p><p className="hint">An independent community project. Not affiliated with or endorsed by FIRST. FIRST and FRC are trademarks of FIRST.</p></div><a className="button secondary" href="https://github.com/linux-cmd/alliancelab" target="_blank" rel="noreferrer">View source<ExternalLink size={15}/></a></section>
    <section className="panel danger-zone"><PanelTitle title="Reset this workspace" description="Delete every event, match observation, pit note, and saved draft on this device."/><button className="button danger-outline" onClick={() => setClear(true)}><Trash2 size={16}/>Reset workspace</button></section>
    {editing && <EventEditor event={editing} onClose={() => setEditing(null)}/>}
    {deleting && <Confirm title={'Delete ' + deleting.name + '?'} description="This also deletes its match observations and pit notes from this device. Export a backup first if you need to keep them." onClose={() => setDeleting(null)} onConfirm={() => { const id = deleting.id; setData({ events: workspace.data.events.filter(e => e.id !== id), matches: workspace.data.matches.filter(m => m.eventId !== id), pits: workspace.data.pits.filter(p => p.eventId !== id) }); notify('Event deleted from this device.'); }}/>}
    {clear && <Confirm title="Reset every event on this device?" description="Export a backup before continuing. All local events and observations will be removed." label="Reset workspace" onClose={() => setClear(false)} onConfirm={() => { setData({ events: [], matches: [], pits: [] }); setPreferences({ selectedEvent: '' }); notify('Workspace reset.'); }}/>}
  </>;
}
