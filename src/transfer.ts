import { parseBundle } from './domain';
import type { Bundle } from './domain';

export const PART_SIZE = 850;
const MAX_PARTS = 200;
export function checksum(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function encodeTransfer(value: Bundle): string[] {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const encoded = btoa(binary);
  const total = Math.ceil(encoded.length / PART_SIZE);
  if (total > MAX_PARTS)
    throw new Error(
      'Too much data for QR transfer. Choose fewer observations or export a JSON backup.',
    );
  const id = checksum(encoded);
  return Array.from(
    { length: total },
    (_, index) =>
      'AL1:' +
      id +
      ':' +
      (index + 1) +
      ':' +
      total +
      ':' +
      encoded.slice(index * PART_SIZE, (index + 1) * PART_SIZE),
  );
}
export type TransferState = { id: string; total: number; parts: Record<number, string> };
export function receivePart(
  previous: TransferState | null,
  text: string,
): { state: TransferState; complete?: Bundle } {
  if (text.length > PART_SIZE + 60) throw new Error('This QR code is too large or unsupported.');
  const parsed = /^AL1:([a-f0-9]{8}):(\d{1,3}):(\d{1,3}):([A-Za-z0-9+/=]+)$/.exec(text);
  if (!parsed) throw new Error('This is not an AllianceLab QR code.');
  const [, id, p, t, value] = parsed;
  const part = Number(p),
    total = Number(t);
  if (part < 1 || total < 1 || total > MAX_PARTS || part > total || value.length > PART_SIZE)
    throw new Error('Invalid QR part numbering.');
  if (previous && (previous.id !== id || previous.total !== total))
    throw new Error('A different transfer is in progress. Reset scanning before starting another.');
  if (previous?.parts[part] && previous.parts[part] !== value)
    throw new Error('Conflicting QR part. Reset and scan again.');
  const state: TransferState = { id, total, parts: { ...previous?.parts, [part]: value } };
  if (Object.keys(state.parts).length !== total) return { state };
  const encoded = Array.from({ length: total }, (_, i) => state.parts[i + 1]).join('');
  if (checksum(encoded) !== id)
    throw new Error('QR transfer checksum failed. Reset and scan again.');
  let raw: string;
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
    );
  } catch {
    throw new Error('QR payload could not be decoded.');
  }
  return { state, complete: parseBundle(raw) };
}
