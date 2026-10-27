import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { version } from '../package.json';
import type { ReactNode } from 'react';
import {
  Home,
  ClipboardList,
  Users,
  Combine,
  ChevronDown,
  Plus,
  Download,
  Menu,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { WorkspaceContext } from './context';
import type { Data, Preferences, Workspace } from './domain';
import { BundleSchema, bundle, MAX_BACKUP_BYTES } from './domain';
import {
  announceSave,
  blankWorkspace,
  CHANGE_KEY,
  download,
  LEGACY_KEY,
  loadWorkspace,
  saveWorkspace,
  storedRaw,
  WorkspaceConflictError,
} from './storage';
import type { LoadedWorkspace } from './storage';
import { demoData } from './demo';
import { IconMark, Confirm } from './components/ui';
import EventEditor from './components/EventEditor';
import Overview from './pages/Overview';

const Scout = lazy(() => import('./pages/Scout'));
const Teams = lazy(() => import('./pages/Teams'));
const Planner = lazy(() => import('./pages/Planner'));
const Transfer = lazy(() => import('./pages/Transfer'));
const Settings = lazy(() => import('./pages/Settings'));
const nav = [
  { id: 'overview', label: 'Home', icon: Home },
  { id: 'scout', label: 'Scout', icon: ClipboardList },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'planner', label: 'Plan', icon: Combine },
];
const pageTitle = (id: string) =>
  nav.find((item) => item.id === id)?.label ||
  (id === 'transfer' ? 'Backups & sharing' : 'Event settings');
function initialPage() {
  const id = location.hash.slice(1);
  return [...nav.map((item) => item.id), 'transfer', 'settings'].includes(id) ? id : 'overview';
}
async function downloadRecovery() {
  try {
    download(await storedRaw(), 'alliancelab-recovery.json');
  } catch {
    /* Recovery may be unavailable if the browser blocks all storage. */
  }
}
function workerVersion(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (value: string | null) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 1500);
    channel.port1.onmessage = (message) =>
      finish(typeof message.data?.version === 'string' ? message.data.version : null);
    try {
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <IconMark />
        <h1>Unable to open this workspace</h1>
        <p>Your saved data is preserved. Download a recovery copy, then reload.</p>
        <button className="button secondary" onClick={() => void downloadRecovery()}>
          Download stored data
        </button>
        <button className="button primary" onClick={() => location.reload()}>
          Reload app
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [initial, setInitial] = useState<LoadedWorkspace | null>(null);
  useEffect(() => {
    let active = true;
    void loadWorkspace().then((value) => {
      if (active) setInitial(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <ErrorBoundary>
      {initial ? (
        <WorkspaceApp initial={initial} />
      ) : (
        <div className="loading">Opening your workspace…</div>
      )}
    </ErrorBoundary>
  );
}

function WorkspaceApp({ initial }: { initial: LoadedWorkspace }) {
  const [workspace, setWorkspace] = useState<Workspace>(initial.workspace);
  const [readOnly, setReadOnly] = useState(!!initial.error);
  const [storageError, setStorageError] = useState(initial.error || '');
  const [externalChange, setExternalChange] = useState(false);
  const [checkingShell, setCheckingShell] = useState(
    () => import.meta.env.PROD && !!navigator.serviceWorker?.controller,
  );
  const [requiresUpdate, setRequiresUpdate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width:840px)').matches);
  const sidebar = useRef<HTMLElement>(null);
  const manage = useRef<HTMLDetailsElement>(null);
  const [create, setCreate] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(initial.revision);
  const source = useRef(crypto.randomUUID());
  const paused = useRef(readOnly || externalChange);
  paused.current = readOnly || externalChange || checkingShell || requiresUpdate;
  const queue = useRef(Promise.resolve());
  const pendingWrites = useRef(0);
  const lastQueued = useRef<Workspace | null>(initial.migrated ? null : initial.workspace);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateConfirm, setUpdateConfirm] = useState(false);
  const [install, setInstall] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const event =
    workspace.data.events.find((item) => item.id === workspace.preferences.selectedEvent) ||
    workspace.data.events[0];
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5000);
  }, []);

  const setData = useCallback(
    (data: Data) => {
      if (paused.current) {
        notify('Saving is paused. Download your work and resolve the storage notice first.');
        return false;
      }
      const checked = BundleSchema.safeParse(bundle(data));
      if (!checked.success) {
        notify('Unable to save: ' + checked.error.issues[0].message);
        return false;
      }
      if (
        new TextEncoder().encode(JSON.stringify(bundle(checked.data.data))).length >
        MAX_BACKUP_BYTES
      ) {
        notify(
          'This workspace exceeds the 50 MB backup limit. Export and archive an older event first.',
        );
        return false;
      }
      setWorkspace((old) => {
        const ids = new Set(checked.data.data.events.map((item) => item.id));
        return {
          ...old,
          data: checked.data.data,
          drafts: Object.fromEntries(
            Object.entries(old.drafts).filter(([key]) => ids.has(key.split(':')[1])),
          ),
          preferences: {
            ...old.preferences,
            selectedEvent: ids.has(old.preferences.selectedEvent)
              ? old.preferences.selectedEvent
              : checked.data.data.events[0]?.id || '',
          },
        };
      });
      return true;
    },
    [notify],
  );
  const setPreferences = useCallback(
    (patch: Partial<Preferences>) =>
      setWorkspace((old) => ({ ...old, preferences: { ...old.preferences, ...patch } })),
    [],
  );
  const setDraft = useCallback(
    (key: string, value: unknown) =>
      setWorkspace((old) => ({ ...old, drafts: { ...old.drafts, [key]: value } })),
    [],
  );
  const clearDraft = useCallback(
    (key: string) =>
      setWorkspace((old) => {
        const drafts = { ...old.drafts };
        delete drafts[key];
        return { ...old, drafts };
      }),
    [],
  );
  const replaceDrafts = useCallback(
    (drafts: Workspace['drafts']) => setWorkspace((old) => ({ ...old, drafts })),
    [],
  );

  const persist = useCallback((snapshot: Workspace) => {
    pendingWrites.current++;
    setSaving(true);
    queue.current = queue.current
      .then(async () => {
        if (paused.current) return;
        try {
          revision.current = await saveWorkspace(snapshot, revision.current);
          announceSave(revision.current, source.current);
          setStorageError('');
        } catch (error) {
          if (error instanceof WorkspaceConflictError) {
            paused.current = true;
            setExternalChange(true);
          }
          setStorageError(
            error instanceof WorkspaceConflictError
              ? error.message
              : 'The browser could not save your latest changes. Keep this tab open and download a backup. Your latest work is in memory.',
          );
        }
      })
      .finally(() => {
        pendingWrites.current--;
        if (!pendingWrites.current) setSaving(false);
      });
  }, []);
  useEffect(() => {
    if (
      readOnly ||
      externalChange ||
      checkingShell ||
      requiresUpdate ||
      lastQueued.current === workspace
    )
      return;
    lastQueued.current = workspace;
    persist(workspace);
  }, [workspace, readOnly, externalChange, checkingShell, requiresUpdate, persist]);

  useEffect(() => {
    const changed = () => {
      paused.current = true;
      setExternalChange(true);
      setStorageError(
        'Another tab changed this workspace. Saving here is paused. Download your work, including drafts, then reload the latest copy.',
      );
    };
    const storage = (event: StorageEvent) => {
      if (event.key === CHANGE_KEY || event.key === LEGACY_KEY) changed();
    };
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANGE_KEY) : null;
    if (channel)
      channel.onmessage = (message) => {
        if (message.data?.source !== source.current && message.data?.revision > revision.current)
          changed();
      };
    const on = () => setOnline(true),
      off = () => setOnline(false);
    const hash = () => {
      setPage(initialPage());
      setMobileMenu(false);
    };
    const installHandler = (event: Event) => {
      event.preventDefault();
      setInstall(event as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener('storage', storage);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('hashchange', hash);
    window.addEventListener('beforeinstallprompt', installHandler);
    return () => {
      channel?.close();
      window.removeEventListener('storage', storage);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('beforeinstallprompt', installHandler);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let disposed = false;
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (disposed) return;
        setRegistration(reg);
        if (reg.waiting) setUpdateAvailable(true);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller)
              setUpdateAvailable(true);
          });
        });
        void navigator.serviceWorker.ready.then(async (ready) => {
          const active = navigator.serviceWorker.controller || ready.active;
          const matches = active && (await workerVersion(active)) === version;
          if (!disposed) {
            setOfflineReady(!!matches);
            setRequiresUpdate(!matches);
            setCheckingShell(false);
          }
        });
      })
      .catch(async () => {
        const controller = navigator.serviceWorker.controller;
        const matches = controller && (await workerVersion(controller)) === version;
        if (!disposed) {
          setCheckingShell(false);
          setRequiresUpdate(!!controller && !matches);
          setOfflineReady(!!matches);
          notify('Offline caching is unavailable. Keep a downloaded backup.');
        }
      });
    return () => {
      disposed = true;
    };
  }, [notify]);
  useEffect(() => {
    document.title = `${pageTitle(page)} · AllianceLab`;
  }, [page]);
  useEffect(() => {
    const media = window.matchMedia('(max-width:840px)');
    const changed = () => {
      setCompact(media.matches);
      setMobileMenu(false);
    };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (!compact || !mobileMenu) return;
    const previous = document.activeElement as HTMLElement | null;
    sidebar.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenu(false);
      }
      if (event.key !== 'Tab') return;
      const controls = [
        ...(sidebar.current?.querySelectorAll<HTMLElement>('a,button,select,summary') || []),
      ].filter((element) => element.getClientRects().length && !element.hasAttribute('disabled'));
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      previous?.focus();
    };
  }, [compact, mobileMenu]);
  function navigate(id: string) {
    if (manage.current) manage.current.open = false;
    setPage(id);
    location.hash = id;
    setMobileMenu(false);
    window.scrollTo({ top: 0 });
  }
  function exploreDemo() {
    if (!workspace.data.events.some((item) => item.id === 'demo-event')) {
      const example = demoData();
      if (
        !setData({
          events: [...workspace.data.events, ...example.events],
          matches: [...workspace.data.matches, ...example.matches],
          pits: [...workspace.data.pits, ...example.pits],
        })
      )
        return;
    }
    setPreferences({ selectedEvent: 'demo-event' });
    navigate('overview');
  }
  const needsEvent = ['scout', 'teams', 'planner'].includes(page) && !event;
  return (
    <WorkspaceContext.Provider
      value={{ workspace, setData, setPreferences, setDraft, clearDraft, replaceDrafts, notify }}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      {mobileMenu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside
        ref={sidebar}
        inert={(compact && !mobileMenu) || checkingShell || requiresUpdate}
        className={'sidebar ' + (mobileMenu ? 'open' : '')}
        aria-label="Main navigation"
      >
        <a href="#overview" className="brand" onClick={() => navigate('overview')}>
          <IconMark />
          <span>AllianceLab</span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        >
          <X size={20} />
        </button>
        <div className="event-switcher">
          <label htmlFor="active-event">Event</label>
          <div>
            <select
              id="active-event"
              value={event?.id || ''}
              onChange={(e) => {
                setPreferences({ selectedEvent: e.target.value });
                setMobileMenu(false);
              }}
            >
              {!workspace.data.events.length && <option value="">Choose an event</option>}
              {workspace.data.events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.demo ? 'Demo · ' : ''}
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
              className={page === item.id ? 'active' : ''}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>
        <details ref={manage} className="manage-menu">
          <summary>
            Manage
            <ChevronDown size={16} />
          </summary>
          <button onClick={() => navigate('transfer')}>Backups & sharing</button>
          <button onClick={() => navigate('settings')}>Event settings</button>
          <button
            onClick={() => {
              setCreate(true);
              setMobileMenu(false);
            }}
          >
            <Plus size={15} />
            Create event
          </button>
          {install && (
            <button
              onClick={() => {
                void install.prompt();
                setInstall(null);
              }}
            >
              <Download size={15} />
              Install app
            </button>
          )}
        </details>
        <div className="sidebar-bottom">
          <span className="local-status">
            <i className={storageError ? 'warning' : ''} />
            {storageError ? 'Saving needs attention' : saving ? 'Saving…' : 'Saved on this device'}
          </span>
          <small>
            {offlineReady ? 'Available offline' : online ? 'Preparing offline access' : 'Offline'}
          </small>
          <a href="https://github.com/linux-cmd/alliancelab" target="_blank" rel="noreferrer">
            Abhijay Panwar · v{version}
          </a>
        </div>
      </aside>
      <div className="app-main" inert={compact && mobileMenu}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-nav"
              aria-label="Open navigation"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>{pageTitle(page)}</span>
          </div>
          <span className="connection">{online ? 'Local workspace' : 'Offline mode'}</span>
        </header>
        <main id="main-content" tabIndex={-1}>
          {storageError && (
            <div className="storage-banner" role="alert">
              <AlertTriangle size={20} />
              <div>
                <strong>Protect your scouting data</strong>
                <p>{storageError}</p>
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={() => {
                      if (readOnly) void downloadRecovery();
                      else
                        download(
                          JSON.stringify(bundle(workspace.data, 'workspace', workspace.drafts)),
                          'alliancelab-backup.json',
                        );
                    }}
                  >
                    <Download size={16} />
                    {readOnly ? 'Download stored recovery data' : 'Download current backup'}
                  </button>
                  {externalChange ? (
                    <button className="button secondary" onClick={() => location.reload()}>
                      Reload latest workspace
                    </button>
                  ) : readOnly ? (
                    <button className="button danger-outline" onClick={() => setRecovery(true)}>
                      Start a new local workspace
                    </button>
                  ) : (
                    <button className="button secondary" onClick={() => persist(workspace)}>
                      Retry saving
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {updateAvailable && (
            <div className="notice">
              <RefreshCw size={18} />
              <span>
                {requiresUpdate
                  ? 'Finish installing this version before scouting.'
                  : 'A new app version is ready.'}
              </span>
              <button
                className="text-button"
                disabled={saving || !!storageError}
                onClick={() => setUpdateConfirm(true)}
              >
                Update app
              </button>
            </div>
          )}
          {(checkingShell || requiresUpdate) && !updateAvailable && (
            <div className="notice">
              <RefreshCw size={18} />
              <span>
                {checkingShell
                  ? 'Checking offline access…'
                  : 'Preparing the app update. Connect to the internet to finish installation.'}
              </span>
            </div>
          )}
          {event?.demo && (
            <div className="demo-banner">
              <span>Demo event · fictional observations</span>
              <button onClick={() => setCreate(true)}>Create your event</button>
            </div>
          )}
          <div inert={checkingShell || requiresUpdate}>
            <Suspense fallback={<div className="loading">Opening…</div>}>
              {page === 'overview' && (
                <Overview
                  event={event}
                  navigate={navigate}
                  createEvent={() => setCreate(true)}
                  exploreDemo={exploreDemo}
                />
              )}
              {needsEvent && (
                <section className="onboarding">
                  <IconMark />
                  <h1>Create your first event</h1>
                  <p>Add a roster, then start scouting.</p>
                  <div className="button-row">
                    <button className="button primary" onClick={() => setCreate(true)}>
                      Create event
                    </button>
                    <button className="button secondary" onClick={exploreDemo}>
                      Explore the demo
                    </button>
                  </div>
                </section>
              )}
              {event && page === 'scout' && <Scout key={event.id} event={event} />}
              {event && page === 'teams' && (
                <Teams key={event.id} event={event} navigate={navigate} />
              )}
              {event && page === 'planner' && <Planner key={event.id} event={event} />}
              {page === 'transfer' && <Transfer key={event?.id || 'none'} event={event} />}
              {page === 'settings' && <Settings createEvent={() => setCreate(true)} />}
            </Suspense>
          </div>
          <footer className="footer">
            <span>AllianceLab</span>
            <span>By Abhijay Panwar</span>
          </footer>
        </main>
      </div>
      {create && <EventEditor onClose={() => setCreate(false)} />}
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={18} />
          </button>
        </div>
      )}
      {recovery && (
        <Confirm
          title="Replace unreadable local storage?"
          description="Download a recovery copy first. This creates an empty workspace; the original v1 browser copy is retained."
          label="Start empty workspace"
          onClose={() => setRecovery(false)}
          onConfirm={() => {
            paused.current = false;
            setReadOnly(false);
            setWorkspace(blankWorkspace());
            setStorageError('');
          }}
        />
      )}
      {updateConfirm && (
        <Confirm
          title="Update and restart the app?"
          description="Wait for Saved on this device before restarting. Your saved observations and drafts will remain."
          label="Update and restart"
          danger={false}
          onClose={() => setUpdateConfirm(false)}
          onConfirm={() => {
            void queue.current.then(() => {
              if (registration?.waiting) {
                navigator.serviceWorker.addEventListener(
                  'controllerchange',
                  () => location.reload(),
                  { once: true },
                );
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              } else location.reload();
            });
          }}
        />
      )}
    </WorkspaceContext.Provider>
  );
}
