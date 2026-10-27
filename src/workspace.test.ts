import { describe, expect, it } from 'vitest';
import { demoData } from './demo';
import { bundle } from './domain';
import { withinBackupLimit, workspaceBackupBytes } from './workspace';

describe('complete restorable workspace size', () => {
  it('measures the exact UTF-8 size including non-ASCII drafts and the envelope', () => {
    const data = demoData(),
      drafts = { 'pit:demo-event:6901': { strengths: 'Autónomo 🤖' } };
    expect(workspaceBackupBytes(data, drafts)).toBe(
      new TextEncoder().encode(JSON.stringify(bundle(data, 'workspace', drafts))).length,
    );
  });
  it('rejects a draft that exceeds the complete backup budget even when saved data fits', () => {
    const data = demoData(),
      budget = workspaceBackupBytes(data, {}) + 50;
    expect(withinBackupLimit({ data, drafts: {} }, budget)).toBe(true);
    expect(
      withinBackupLimit(
        { data, drafts: { 'match:demo-event': { notes: 'x'.repeat(100) } } },
        budget,
      ),
    ).toBe(false);
    expect(
      withinBackupLimit({ data, drafts: { 'match:demo-event': { notes: 'Short' } } }, budget),
    ).toBe(true);
  });
});
