import { describe, expect, it } from 'vitest';
import { bundle } from './domain';
import { demoData } from './demo';
import { encodeTransfer, receivePart } from './transfer';
import type { TransferState } from './transfer';
describe('multipart QR transfer', () => {
  it('reassembles out-of-order frames and accepts repeated frames', () => {
    const data = demoData(); data.matches = data.matches.slice(0, 1); data.pits = []; data.matches[0].notes = 'Autónomo 🤖';
    const source = bundle(data, 'event'), parts = encodeTransfer(source);
    let state: TransferState | null = null, complete;
    for (const part of parts.toReversed()) { const result = receivePart(state, part); state = result.state; complete = result.complete || complete; }
    expect(complete).toEqual(source);
    expect(receivePart(state, parts[0]).complete).toEqual(source);
  });
  it('rejects unrelated codes, bad part counts and mixed transfers', () => {
    expect(() => receivePart(null, 'https://example.com')).toThrow(/not an AllianceLab/);
    expect(() => receivePart(null, 'AL1:12345678:0:1:a')).toThrow(/numbering/);
    expect(() => receivePart(null, 'AL1:12345678:1:201:a')).toThrow(/numbering/);
    const source = bundle(demoData()); const parts = encodeTransfer(source); const state = receivePart(null, parts[0]).state;
    expect(() => receivePart(state, parts[1].replace(/AL1:[a-f0-9]{8}/, 'AL1:00000000'))).toThrow(/different transfer/);
  });
  it('detects tampered content before import', () => {
    const parts = encodeTransfer(bundle(demoData())); let state: TransferState | null = null;
    parts[parts.length - 1] = parts[parts.length - 1].slice(0, -1) + (parts.at(-1)!.endsWith('A') ? 'B' : 'A');
    expect(() => { for (const part of parts) state = receivePart(state, part).state; }).toThrow(/checksum/);
  });
  it('bounds transfer size', () => {
    const data = demoData(); data.matches = Array.from({ length: 500 }, (_, i) => ({ ...data.matches[0], id: 'large-' + i, notes: 'x'.repeat(2000) }));
    expect(() => encodeTransfer(bundle(data))).toThrow(/Too much data/);
  });
});
