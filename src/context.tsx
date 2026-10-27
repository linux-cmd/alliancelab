import { createContext, useContext } from 'react';
import type { Data, Preferences, Workspace } from './domain';

export type WorkspaceContextValue = {
  workspace: Workspace;
  setData: (next: Data, drafts?: Workspace['drafts']) => boolean;
  setPreferences: (next: Partial<Preferences>) => void;
  setDraft: (key: string, value: unknown) => boolean;
  clearDraft: (key: string) => void;
  notify: (message: string) => void;
};
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('Workspace context unavailable');
  return value;
}
