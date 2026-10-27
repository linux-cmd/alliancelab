import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { bundle } from './domain';
import { demoData } from './demo';
import {
  blankWorkspace,
  decodeStored,
  LEGACY_KEY,
  loadWorkspace,
  previousBackup,
  saveWorkspace,
  WorkspaceConflictError,
} from './storage';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('indexedDB', new IDBFactory());
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
});
const workspace = () => ({ ...blankWorkspace(), data: demoData() });
describe('transactional local persistence', () => {
  it('migrates v1 localStorage without changing observations or deleting the original', async () => {
    const source = workspace();
    const old = {
      ...bundle(source.data),
      schemaVersion: 1,
      data: {
        ...source.data,
        events: source.data.events.map(({ schedule: _schedule, ...event }) => event),
      },
    };
    const original = JSON.stringify({
      backup: old,
      preferences: source.preferences,
      drafts: { 'pit:demo-event:6901': { note: 'Keep this' } },
    });
    localStorage.setItem(LEGACY_KEY, original);
    const migrated = await loadWorkspace();
    expect(migrated.migrated).toBe(true);
    expect(migrated.error).toBeNull();
    expect(migrated.workspace.data).toEqual(source.data);
    expect(migrated.workspace.drafts).toEqual({ 'pit:demo-event:6901': { note: 'Keep this' } });
    await saveWorkspace(migrated.workspace, 0);
    expect((await loadWorkspace()).workspace).toEqual(migrated.workspace);
    expect(localStorage.getItem(LEGACY_KEY)).toBe(original);
  });
  it('keeps the previous data snapshot when only drafts and preferences change', async () => {
    const original = workspace();
    let revision = await saveWorkspace(original, 0);
    const changed = structuredClone(original);
    changed.data.matches[0].notes = 'Corrected observation';
    revision = await saveWorkspace(changed, revision);
    changed.drafts = { 'match:demo-event': { notes: 'Still working' } };
    changed.preferences.scout = 'Another scout';
    await saveWorkspace(changed, revision);
    expect(JSON.parse((await previousBackup())!).data).toEqual(original.data);
  });
  it('rejects stale writers atomically', async () => {
    const original = workspace();
    await saveWorkspace(original, 0);
    const stale = workspace();
    stale.data.matches[0].notes = 'Must not overwrite';
    await expect(saveWorkspace(stale, 0)).rejects.toBeInstanceOf(WorkspaceConflictError);
    expect((await loadWorkspace()).workspace.data).toEqual(original.data);
  });
  it('rolls back both current and previous data when a write fails', async () => {
    const original = workspace();
    await saveWorkspace(original, 0);
    const changed = workspace();
    changed.data.matches[0].notes = 'Not committed';
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (key === 'current') throw new DOMException('Full', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(saveWorkspace(changed, 1)).rejects.toThrow('Full');
    expect((await loadWorkspace()).workspace.data).toEqual(original.data);
    expect(await previousBackup()).toBeNull();
  });
  it('preserves an unreadable original until reset and refuses unknown storage formats', async () => {
    localStorage.setItem(LEGACY_KEY, '{unreadable');
    expect((await loadWorkspace()).error).toMatch(/could not be read/);
    expect(localStorage.getItem(LEGACY_KEY)).toBe('{unreadable');
    await saveWorkspace(blankWorkspace(), 0);
    expect((await loadWorkspace()).error).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBe('{unreadable');
    expect(() =>
      decodeStored(JSON.stringify({ storageVersion: 100, backup: bundle(demoData()) })),
    ).toThrow(/Unsupported/);
  });
});
