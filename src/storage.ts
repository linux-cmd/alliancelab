import { bundle, emptyData, parseBundle } from './domain';
import type { Workspace } from './domain';

const KEY = 'alliancelab.workspace.v1';
export const blankWorkspace = (): Workspace => ({ data: emptyData(), preferences: { selectedEvent: '', scout: '', homeTeam: '' }, drafts: {} });
export function loadWorkspace(): { workspace: Workspace; error: string | null } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { workspace: blankWorkspace(), error: null };
    const parsed = JSON.parse(raw);
    const data = parseBundle(JSON.stringify(parsed.backup)).data;
    return { workspace: { data, preferences: { selectedEvent: typeof parsed.preferences?.selectedEvent === 'string' ? parsed.preferences.selectedEvent : '', scout: typeof parsed.preferences?.scout === 'string' ? parsed.preferences.scout.slice(0, 100) : '', homeTeam: typeof parsed.preferences?.homeTeam === 'string' ? parsed.preferences.homeTeam.slice(0, 5) : '' }, drafts: parsed.drafts && typeof parsed.drafts === 'object' && !Array.isArray(parsed.drafts) ? parsed.drafts : {} }, error: null };
  } catch { return { workspace: blankWorkspace(), error: 'Saved data could not be read. It has been left untouched. Download the stored data before resetting or restoring a backup.' }; }
}
export function saveWorkspace(workspace: Workspace): void {
  localStorage.setItem(KEY, JSON.stringify({ backup: bundle(workspace.data), preferences: workspace.preferences, drafts: workspace.drafts }));
}
export const storedRaw = () => localStorage.getItem(KEY) || '';
export function download(content: string | Blob, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
