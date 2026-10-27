import { bundle, emptyData, MAX_BACKUP_BYTES } from './domain';
import type { Data, Workspace } from './domain';

const encoder = new TextEncoder();
const bytes = (value: unknown) => encoder.encode(JSON.stringify(value)).length;
// Workspace data enters state through schema parsing and is immutable afterwards.
// Draft keystrokes only remeasure drafts, rather than serializing all observations.
const dataSizes = new WeakMap<Data, number>();
export function workspaceBackupBytes(data: Data, drafts: Workspace['drafts']): number {
  let dataSize = dataSizes.get(data);
  if (dataSize === undefined) {
    dataSize = bytes(data);
    dataSizes.set(data, dataSize);
  }
  const envelope = { ...bundle(emptyData(), 'workspace', {}), data: null, localDrafts: null };
  return bytes(envelope) - 8 + dataSize + bytes(drafts);
}
export function withinBackupLimit(
  workspace: Pick<Workspace, 'data' | 'drafts'>,
  limit = MAX_BACKUP_BYTES,
) {
  return workspaceBackupBytes(workspace.data, workspace.drafts) <= limit;
}
