import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { LayoutDashboard, ClipboardList, Users, Combine, ArrowRightLeft, Settings2, ChevronDown, Plus, Wifi, WifiOff, Menu, X, CheckCircle2, FlaskConical, Download, AlertTriangle, ArrowUpRight, RefreshCw } from 'lucide-react';
import { WorkspaceContext } from './context';
import type { Data, Preferences, Workspace } from './domain';
import { BundleSchema, bundle } from './domain';
import { blankWorkspace, download, loadWorkspace, saveWorkspace, storedRaw } from './storage';
import { demoData } from './demo';
import { IconMark, Confirm, Breadcrumb } from './components/ui';
import EventEditor from './components/EventEditor';
import Overview from './pages/Overview';

const Scout = lazy(() => import('./pages/Scout'));
const Teams = lazy(() => import('./pages/Teams'));
const Planner = lazy(() => import('./pages/Planner'));
const Transfer = lazy(() => import('./pages/Transfer'));
const Settings = lazy(() => import('./pages/Settings'));
const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'scout', label: 'Scout a match', icon: ClipboardList },
  { id: 'teams', label: 'Teams & insights', icon: Users },
  { id: 'planner', label: 'Alliance lab', icon: Combine },
  { id: 'transfer', label: 'Transfer center', icon: ArrowRightLeft },
  { id: 'settings', label: 'Event settings', icon: Settings2 },
];
function initialPage() { const id = location.hash.slice(1); return nav.some(n => n.id === id) ? id : 'overview'; }

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Preserve stored data for recovery. */ }
  render() {
    return this.state.error ? <div className="fatal-error"><IconMark/><h1>The workspace hit a snag.</h1><p>Your saved browser data has not been cleared. Download a recovery copy, then reload the app.</p><button className="button secondary" onClick={() => { try { download(storedRaw(), 'alliancelab-recovery.json'); } catch { /* Browser may block storage. */ } }}>Download stored data</button><button className="button primary" onClick={() => location.reload()}>Reload app</button></div> : this.props.children;
  }
}
export default function App() { return <ErrorBoundary><WorkspaceApp/></ErrorBoundary>; }

function WorkspaceApp() {
  const [initial] = useState(loadWorkspace);
  const [workspace, setWorkspace] = useState<Workspace>(initial.workspace);
  const [readOnly, setReadOnly] = useState(!!initial.error);
  const [storageError, setStorageError] = useState(initial.error || '');
  const [recovery, setRecovery] = useState(false);
  const [externalChange, setExternalChange] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [create, setCreate] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateConfirm, setUpdateConfirm] = useState(false);
  const [install, setInstall] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const event = workspace.data.events.find(e => e.id === workspace.preferences.selectedEvent) || workspace.data.events[0];
  const notify = useCallback((message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 5000); }, []);
  const setData = useCallback((data: Data) => {
    const checked = BundleSchema.safeParse(bundle(data));
    if (!checked.success) { notify('Data was not saved: ' + checked.error.issues[0].message); return; }
    setWorkspace(old => {
      const ids = new Set(checked.data.data.events.map(e => e.id));
      const drafts = Object.fromEntries(Object.entries(old.drafts).filter(([key]) => ids.has(key.split(':')[1])));
      return { ...old, data: checked.data.data, drafts, preferences: { ...old.preferences, selectedEvent: ids.has(old.preferences.selectedEvent) ? old.preferences.selectedEvent : checked.data.data.events[0]?.id || '' } };
    });
  }, [notify]);
  const setPreferences = useCallback((patch: Partial<Preferences>) => setWorkspace(old => ({ ...old, preferences: { ...old.preferences, ...patch } })), []);
  const setDraft = useCallback((key: string, value: unknown) => setWorkspace(old => ({ ...old, drafts: { ...old.drafts, [key]: value } })), []);
  const clearDraft = useCallback((key: string) => setWorkspace(old => { const drafts = { ...old.drafts }; delete drafts[key]; return { ...old, drafts }; }), []);
  useEffect(() => {
    if (readOnly || externalChange) return;
    try { saveWorkspace(workspace); setStorageError(''); }
    catch { setStorageError('This browser could not save your latest changes. Keep this tab open and download a backup now. Your changes are currently in memory only.'); }
  }, [workspace, readOnly, externalChange]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false), hash = () => { setPage(initialPage()); setMobileMenu(false); };
    const installHandler = (event: Event) => { event.preventDefault(); setInstall(event as Event & { prompt: () => Promise<void> }); };
    const changed = (event: StorageEvent) => { if (event.key === 'alliancelab.workspace.v1') { setExternalChange(true); setStorageError('Another tab changed this workspace. Saving in this tab is paused to prevent overwriting those changes. Export any unsaved work, then reload to use the latest data.'); } };
    window.addEventListener('storage', changed);
    window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('hashchange', hash); window.addEventListener('beforeinstallprompt', installHandler);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('hashchange', hash); window.removeEventListener('beforeinstallprompt', installHandler); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let disposed = false;
    navigator.serviceWorker.register('/sw.js').then(reg => {
      if (disposed) return; setRegistration(reg);
      if (reg.waiting) setUpdateAvailable(true);
      reg.addEventListener('updatefound', () => { const worker = reg.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateAvailable(true); }); });
      navigator.serviceWorker.ready.then(() => { if (!disposed) setOfflineReady(true); });
    }).catch(() => { if (!disposed) notify('Offline installation is unavailable. You can still save observations locally and export a backup.'); });
    return () => { disposed = true; };
  }, [notify]);
  useEffect(() => { document.title = (nav.find(n => n.id === page)?.label || 'Workspace') + ' · AllianceLab'; }, [page]);
  function navigate(id: string) { setPage(id); location.hash = id; setMobileMenu(false); window.scrollTo({ top: 0 }); }
  function exploreDemo() {
    if (!workspace.data.events.some(e => e.id === 'demo-event')) { const example = demoData(); setData({ events: [...workspace.data.events, ...example.events], matches: [...workspace.data.matches, ...example.matches], pits: [...workspace.data.pits, ...example.pits] }); }
    setPreferences({ selectedEvent: 'demo-event' }); navigate('overview'); notify('Demo observations are fictional. Your actual events stay separate.');
  }
  const needsEvent = ['scout', 'teams', 'planner'].includes(page) && !event;
  return <WorkspaceContext.Provider value={{ workspace, setData, setPreferences, setDraft, clearDraft, notify }}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileMenu && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}
    <aside className={'sidebar ' + (mobileMenu ? 'open' : '')} aria-label="Main navigation"><a href="#overview" className="brand" onClick={() => navigate('overview')}><IconMark/><span>AllianceLab<small>SCOUTING, TOGETHER.</small></span></a><button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={20}/></button><div className="event-switcher"><label htmlFor="active-event">YOUR WORKSPACE</label><div><select id="active-event" value={event?.id || ''} onChange={e => { setPreferences({ selectedEvent: e.target.value }); setMobileMenu(false); }}>{!workspace.data.events.length && <option value="">No event selected</option>}{workspace.data.events.map(e => <option key={e.id} value={e.id}>{e.demo ? 'Demo · ' : ''}{e.name}</option>)}</select><ChevronDown size={14}/></div><button onClick={() => { setCreate(true); setMobileMenu(false); }}><Plus size={13}/>Create another event</button></div>
    <span className="nav-label">THE WORKSPACE</span><nav>{nav.map(item => <button key={item.id} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined} className={page === item.id ? 'active' : ''}><item.icon size={18}/>{item.label}{page === item.id && <i/>}</button>)}</nav>
    <div className="sidebar-bottom"><div className="offline-note"><span className="offline-note-icon">{online ? <Wifi size={17}/> : <WifiOff size={17}/>}</span><div><strong>{online ? 'Ready for the field' : 'Scouting offline'}</strong><span>{offlineReady ? 'App cached · data stays local' : 'Your data stays on this device'}</span></div><i/></div><div className="author"><span>AP</span><div><strong>Abhijay Panwar</strong><small>Creator & maintainer</small></div><span className="version">v1.0</span></div></div></aside>
    <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-nav" aria-label="Open navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)}><Menu size={21}/></button><Breadcrumb>{nav.find(n => n.id === page)?.label}</Breadcrumb></div><div className="topbar-right">{install && <button className="text-button install-button" onClick={() => { void install.prompt(); setInstall(null); }}><Download size={15}/>Install app</button>}<span className="connection"><i className={online ? '' : 'offline'}/>{online ? 'Local workspace' : 'Offline mode'}</span><span className="profile-chip">{workspace.preferences.scout ? workspace.preferences.scout.slice(0, 2).toUpperCase() : 'AP'}</span></div></header>
    <main id="main-content" tabIndex={-1}>
      {storageError && <div className="storage-banner" role="alert"><AlertTriangle size={19}/><div><strong>Protect your scouting data</strong><p>{storageError}</p><div className="button-row"><button className="button secondary" onClick={() => { if (readOnly) download(storedRaw(), 'alliancelab-recovery.json'); else download(JSON.stringify(bundle(workspace.data), null, 2), 'alliancelab-backup.json'); }}><Download size={14}/>{readOnly ? 'Download stored recovery data' : 'Download current backup'}</button>{externalChange ? <button className="button secondary" onClick={() => location.reload()}>Reload latest workspace</button> : readOnly ? <button className="button danger-outline" onClick={() => setRecovery(true)}>Start a new local workspace</button> : <button className="button secondary" onClick={() => { try { saveWorkspace(workspace); setStorageError(''); notify('Local saving is working again.'); } catch { notify('Browser storage is still unavailable. Keep an exported backup.'); } }}>Retry saving</button>}</div></div></div>}
      {updateAvailable && <div className="notice subtle"><RefreshCw size={17}/><span>A new app version is ready.</span><button className="text-button" onClick={() => setUpdateConfirm(true)}>Update app</button></div>}
      {event?.demo && <div className="demo-banner"><FlaskConical size={16}/><span><strong>You’re exploring the demo.</strong> All observations are fictional.</span><button onClick={() => setCreate(true)}>Create your event<ArrowUpRight size={14}/></button></div>}
      <Suspense fallback={<div className="loading"><span/>Opening your workspace…</div>}>
      {page === 'overview' && <Overview event={event} navigate={navigate} createEvent={() => setCreate(true)}/>}
      {needsEvent && <div className="onboarding"><IconMark/><span className="eyebrow">START WITH YOUR EVENT</span><h1>A place for every observation.</h1><p>Create an event and add your roster, or take a look around with the demo.</p><div className="button-row"><button className="button primary" onClick={() => setCreate(true)}><Plus size={17}/>Create event</button><button className="button secondary" onClick={exploreDemo}><FlaskConical size={17}/>Explore the demo</button></div></div>}
      {event && page === 'scout' && <Scout key={event.id} event={event}/>}
      {event && page === 'teams' && <Teams key={event.id} event={event} navigate={navigate}/>}
      {event && page === 'planner' && <Planner key={event.id} event={event}/>}
      {page === 'transfer' && <Transfer key={event?.id || 'none'} event={event}/>}
      {page === 'settings' && <Settings createEvent={() => setCreate(true)}/>}
      </Suspense>
      {!event && page === 'overview' && <div className="demo-callout"><FlaskConical size={20}/><div><strong>Want to see a full workspace first?</strong><p>Explore a fictional practice event, from observations to alliance planning.</p></div><button className="button secondary" onClick={exploreDemo}>Explore the demo<ArrowUpRight size={15}/></button></div>}
      <footer className="footer"><span>AllianceLab <span>·</span> Made for the people watching every match.</span><span>By Abhijay Panwar <span>·</span> v1.0.0</span></footer>
    </main></div>
    {create && <EventEditor onClose={() => setCreate(false)}/>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={19}/>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16}/></button></div>}
    {recovery && <Confirm title="Replace unreadable local storage?" description="Download the recovery data first. This starts an empty workspace and replaces the saved browser copy, then you can import a valid backup." label="Start empty workspace" onClose={() => setRecovery(false)} onConfirm={() => { setWorkspace(blankWorkspace()); setReadOnly(false); setStorageError(''); }}/>}
    {updateConfirm && <Confirm title="Update and restart the app?" description="Saved observations and match drafts will remain. Save any pit form changes before restarting." label="Update and restart" danger={false} onClose={() => setUpdateConfirm(false)} onConfirm={() => { if (registration?.waiting) { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); registration.waiting.postMessage({ type: 'SKIP_WAITING' }); } else location.reload(); }}/>}
  </WorkspaceContext.Provider>;
}
