import { bundle, emptyData, parseBundle } from './domain';
import type { Workspace } from './domain';

export const LEGACY_KEY = 'alliancelab.workspace.v1';
export const CHANGE_KEY = 'alliancelab.changed.v2';
const DATABASE = 'alliancelab';
const STORE = 'workspace';
type StoredWorkspace = {
  storageVersion: 2;
  backup: ReturnType<typeof bundle>;
  preferences: Workspace['preferences'];
  drafts: Workspace['drafts'];
  revision: number;
};
export type LoadedWorkspace = {
  workspace: Workspace;
  error: string | null;
  revision: number;
  migrated: boolean;
};
export class WorkspaceConflictError extends Error {}
export const blankWorkspace = (): Workspace => ({
  data: emptyData(),
  preferences: { selectedEvent: '', scout: '', homeTeam: '' },
  drafts: {},
});

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Another browser tab is blocking storage.'));
  });
}
async function readRecord(key: string): Promise<StoredWorkspace | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(key);
    transaction.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
const revisionOf = (record?: StoredWorkspace) =>
  Number.isSafeInteger(record?.revision) ? record!.revision : 0;

export function decodeStored(raw: string): Workspace {
  const parsed = JSON.parse(raw);
  if (parsed.storageVersion !== undefined && parsed.storageVersion !== 2)
    throw new Error('Unsupported workspace storage version.');
  const data = parseBundle(JSON.stringify(parsed.backup)).data;
  const preferences = parsed.preferences || {};
  return {
    data,
    preferences: {
      selectedEvent: typeof preferences.selectedEvent === 'string' ? preferences.selectedEvent : '',
      scout: typeof preferences.scout === 'string' ? preferences.scout.slice(0, 100) : '',
      homeTeam: typeof preferences.homeTeam === 'string' ? preferences.homeTeam.slice(0, 5) : '',
      station: /^(red|blue)-[1-3]$/.test(preferences.station) ? preferences.station : '',
      lastBackupAt:
        typeof preferences.lastBackupAt === 'string' &&
        Number.isFinite(Date.parse(preferences.lastBackupAt))
          ? preferences.lastBackupAt
          : '',
    },
    drafts:
      parsed.drafts && typeof parsed.drafts === 'object' && !Array.isArray(parsed.drafts)
        ? parsed.drafts
        : {},
  };
}

export async function loadWorkspace(): Promise<LoadedWorkspace> {
  let record: StoredWorkspace | undefined;
  try {
    record = await readRecord('current');
  } catch {
    /* Writes will report unavailable storage. */
  }
  try {
    const raw = record ? JSON.stringify(record) : localStorage.getItem(LEGACY_KEY);
    return {
      workspace: raw ? decodeStored(raw) : blankWorkspace(),
      error: null,
      revision: revisionOf(record),
      migrated: !record && !!raw,
    };
  } catch {
    return {
      workspace: blankWorkspace(),
      error:
        'Saved data could not be read. The original is untouched. Download a recovery copy before resetting or restoring a backup.',
      revision: revisionOf(record),
      migrated: false,
    };
  }
}

export async function saveWorkspace(
  workspace: Workspace,
  expectedRevision: number,
): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const get = store.get('current');
    let conflict = false;
    let failure: unknown;
    const revision = expectedRevision + 1;
    get.onsuccess = () => {
      const old = get.result as StoredWorkspace | undefined;
      if (revisionOf(old) !== expectedRevision) {
        conflict = true;
        transaction.abort();
        return;
      }
      try {
        if (old?.backup?.data && JSON.stringify(old.backup.data) !== JSON.stringify(workspace.data))
          store.put(old, 'previous');
        store.put(
          {
            storageVersion: 2,
            backup: bundle(workspace.data),
            preferences: workspace.preferences,
            drafts: workspace.drafts,
            revision,
          } satisfies StoredWorkspace,
          'current',
        );
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(revision);
    };
    transaction.onabort = () => {
      db.close();
      reject(
        conflict
          ? new WorkspaceConflictError(
              'Another tab saved newer data. Export your work, then reload.',
            )
          : failure || transaction.error || new Error('Storage write failed.'),
      );
    };
    transaction.onerror = () => {
      /* onabort supplies the final failure */
    };
  });
}

export async function storedRaw(): Promise<string> {
  try {
    const current = await readRecord('current');
    if (current) return JSON.stringify(current, null, 2);
  } catch {
    /* Legacy recovery still works without IndexedDB. */
  }
  return localStorage.getItem(LEGACY_KEY) || '';
}
export async function previousBackup(): Promise<string | null> {
  const previous = await readRecord('previous');
  if (previous) return JSON.stringify(bundle(decodeStored(JSON.stringify(previous)).data), null, 2);
  const legacy = localStorage.getItem(LEGACY_KEY);
  return legacy ? JSON.stringify(bundle(decodeStored(legacy).data), null, 2) : null;
}
export function announceSave(revision: number, source: string) {
  const message = { revision, source };
  try {
    localStorage.setItem(CHANGE_KEY, JSON.stringify(message));
  } catch {
    /* Database revision checks also prevent overwrites. */
  }
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANGE_KEY);
    channel.postMessage(message);
    channel.close();
  }
}
export function download(content: string | Blob, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
