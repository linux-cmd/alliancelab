import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Upload,
  FileJson,
  Table2,
  QrCode,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useWorkspace } from '../context';
import { bundle, mergeData, parseBundle, now, MAX_BACKUP_BYTES } from '../domain';
import type { Bundle, ScoutEvent } from '../domain';
import { matchesCsv } from '../analytics';
import { decodeStored, download } from '../storage';
import { encodeTransfer, receivePart } from '../transfer';
import type { TransferState } from '../transfer';
import Scanner from '../components/Scanner';
import { PageHeading, PanelTitle, Modal, Tag, fmt } from '../components/ui';

export default function Transfer({ event }: { event?: ScoutEvent }) {
  const { workspace, setData, setPreferences, notify } = useWorkspace();
  const [tab, setTab] = useState<'files' | 'qr'>('files');
  const [error, setError] = useState('');
  const [incoming, setIncoming] = useState<Bundle | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [count, setCount] = useState(1);
  const [includePits, setIncludePits] = useState(false);
  const [parts, setParts] = useState<string[]>([]);
  const [part, setPart] = useState(0);
  const [qr, setQr] = useState('');
  const [qrPart, setQrPart] = useState('');
  const [qrError, setQrError] = useState('');
  const [receiver, setReceiver] = useState<TransferState | null>(null);
  const receiverRef = useRef<TransferState | null>(null);
  const lastScan = useRef('');
  const [scanError, setScanError] = useState('');
  const [paste, setPaste] = useState('');
  useEffect(() => {
    let active = true;
    setQr('');
    setQrError('');
    if (parts[part])
      QRCode.toDataURL(parts[part], {
        scale: 8,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#172b26', light: '#ffffff' },
      })
        .then((url) => {
          if (active) {
            setQr(url);
            setQrPart(parts[part]);
          }
        })
        .catch(() => {
          if (active) setQrError('This QR frame could not be generated. Export a backup instead.');
        });
    return () => {
      active = false;
    };
  }, [parts, part]);
  function exportBackup(eventOnly = false) {
    const data =
      eventOnly && event
        ? {
            events: [event],
            matches: workspace.data.matches.filter((m) => m.eventId === event.id),
            pits: workspace.data.pits.filter((p) => p.eventId === event.id),
          }
        : workspace.data;
    download(
      JSON.stringify(
        bundle(data, eventOnly ? 'event' : 'workspace', eventOnly ? undefined : workspace.drafts),
      ),
      'alliancelab-' +
        (eventOnly ? 'event-' : 'backup-') +
        new Date().toISOString().slice(0, 10) +
        '.json',
    );
    if (!eventOnly) setPreferences({ lastBackupAt: now() });
    notify('Backup downloaded. Store it somewhere outside your browser.');
  }
  async function file(file: File) {
    setError('');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 50 MB.');
      const raw = await file.text();
      const value = JSON.parse(raw);
      const recovery =
        value && typeof value === 'object' && 'backup' in value ? decodeStored(raw) : null;
      const parsed = recovery
        ? bundle(recovery.data, 'workspace', recovery.drafts)
        : parseBundle(raw);
      setIncoming(parsed);
      setMode('merge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The file could not be read.');
    }
  }
  function generate() {
    setQrError('');
    try {
      if (!event) throw new Error('Create or select an event first.');
      const matches = [...workspace.data.matches]
        .filter((m) => m.eventId === event.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, count);
      const data = {
        events: [event],
        matches: count === 0 ? [] : matches,
        pits: includePits
          ? workspace.data.pits.filter(
              (p) => p.eventId === event.id && matches.some((m) => m.team === p.team),
            )
          : [],
      };
      setParts(encodeTransfer(bundle(data, 'event')));
      setPart(0);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'Could not generate transfer.');
    }
  }
  function scan(text: string) {
    if (text === lastScan.current) return;
    lastScan.current = text;
    try {
      const result = receivePart(receiverRef.current, text);
      receiverRef.current = result.state;
      setReceiver(result.state);
      setScanError('');
      if (result.complete) {
        setIncoming(result.complete);
        setMode('merge');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'QR code could not be read.');
    }
  }
  function resetReceiver() {
    receiverRef.current = null;
    setReceiver(null);
    lastScan.current = '';
    setScanError('');
  }
  let preview: ReturnType<typeof mergeData> | null = null,
    previewError = '';
  if (incoming && mode === 'merge') {
    try {
      preview = mergeData(workspace.data, incoming.data);
    } catch (err) {
      previewError = err instanceof Error ? err.message : 'These records cannot be merged.';
    }
  }
  function apply() {
    if (!incoming || (mode === 'merge' && !preview)) return;
    if (
      !setData(
        mode === 'replace' ? incoming.data : preview!.data,
        mode === 'replace' ? incoming.localDrafts || {} : undefined,
      )
    )
      return;
    if (mode === 'replace' || !event)
      setPreferences({ selectedEvent: incoming.data.events[0]?.id || '' });
    notify(
      mode === 'replace'
        ? 'Workspace restored from backup.'
        : 'Import complete: ' +
            preview!.added +
            ' added, ' +
            preview!.updated +
            ' updated, ' +
            preview!.skipped +
            ' unchanged.',
    );
    setIncoming(null);
    resetReceiver();
  }
  return (
    <>
      <PageHeading
        eyebrow=""
        title="Backups & sharing"
        description="Keep a backup or bring in your crew’s observations."
      />
      <div className="tab-bar">
        <button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>
          <ArrowRightLeft size={16} />
          Backups & exports
        </button>
        <button className={tab === 'qr' ? 'active' : ''} onClick={() => setTab('qr')}>
          <QrCode size={16} />
          QR transfer
        </button>
      </div>
      {tab === 'files' ? (
        <>
          <div className="transfer-cards">
            <section className="panel export-card">
              <span className="feature-icon">
                <FileJson size={24} />
              </span>
              <h2>Back up your workspace</h2>
              <p>
                Your workspace lives in this browser. A JSON backup preserves event definitions,
                match observations, pit notes, and local drafts.
              </p>
              <div className="backup-counts">
                <span>
                  <strong>{workspace.data.events.length}</strong> events
                </span>
                <span>
                  <strong>{fmt(workspace.data.matches.length, 0)}</strong> matches
                </span>
                <span>
                  <strong>{workspace.data.pits.length}</strong> pit notes
                </span>
              </div>
              <button className="button primary" onClick={() => exportBackup()}>
                <Download size={16} />
                Download workspace backup
              </button>
              {event && (
                <button className="text-button" onClick={() => exportBackup(true)}>
                  Export current event only
                  <Download size={14} />
                </button>
              )}
            </section>
            <section className="panel import-card">
              <span className="feature-icon">
                <Upload size={24} />
              </span>
              <h2>Import a backup</h2>
              <p>
                Import a teammate’s JSON file or restore a backup. You’ll review the contents before
                anything changes.
              </p>
              <label className="upload-zone">
                <Upload size={23} />
                <strong>Choose an AllianceLab JSON file</strong>
                <span>Up to 50 MB · validated before import</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  aria-label="Import JSON backup"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void file(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </section>
          </div>
          <section className="panel csv-panel">
            <div className="feature-icon">
              <Table2 size={23} />
            </div>
            <div>
              <h2>Export match data</h2>
              <p>
                Export this event’s match observations as CSV, including raw metrics, scout names,
                and record IDs.
              </p>
            </div>
            <button
              className="button secondary"
              disabled={!event}
              onClick={() => {
                if (event) {
                  download(
                    matchesCsv(event, workspace.data.matches),
                    'alliancelab-matches.csv',
                    'text/csv;charset=utf-8',
                  );
                  notify('Match observations exported as CSV.');
                }
              }}
            >
              <Download size={16} />
              Export match CSV
            </button>
          </section>
          <details className="notice subtle">
            <summary>How imports are merged</summary>
            <CheckCircle2 size={19} />
            <span>
              Imports preserve record IDs. Newer revisions update existing observations; repeats are
              skipped. Existing event settings are preserved. Conflicting metrics or record
              identities stop a merge.
            </span>
          </details>
        </>
      ) : (
        <div className="transfer-cards qr-panels">
          <section className="panel">
            <PanelTitle
              title="Send observations"
              description="Keep the receiving camera on each frame until it is counted."
            />
            <div className="form-grid">
              <label>
                Send
                <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  <option value={0}>Event setup only</option>
                  <option value={1}>Latest match observation</option>
                  <option value={5}>Latest 5 observations</option>
                  <option value={10}>Latest 10 observations</option>
                </select>
              </label>
              <div className="align-end">
                <button className="button secondary" onClick={generate} disabled={!event}>
                  <QrCode size={16} />
                  Generate QR frames
                </button>
              </div>
            </div>
            <label className="checkbox-label small-check">
              <input
                type="checkbox"
                checked={includePits}
                onChange={(e) => setIncludePits(e.target.checked)}
              />
              Include pit notes for these teams
            </label>
            {qrError && (
              <p role="alert" className="error">
                {qrError}
              </p>
            )}
            {qr && qrPart === parts[part] ? (
              <div className="qr-output">
                <img
                  src={qr}
                  alt={'AllianceLab transfer QR frame ' + (part + 1) + ' of ' + parts.length}
                />
                <div className="qr-nav">
                  <button
                    className="icon-button"
                    aria-label="Previous QR frame"
                    disabled={part === 0}
                    onClick={() => setPart(part - 1)}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <strong>
                    Frame {part + 1} of {parts.length}
                  </strong>
                  <button
                    className="icon-button"
                    aria-label="Next QR frame"
                    disabled={part === parts.length - 1}
                    onClick={() => setPart(part + 1)}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                <div className="button-row">
                  <button
                    className="text-button"
                    onClick={() =>
                      download(
                        new Blob(
                          [Uint8Array.from(atob(qr.split(',')[1]), (c) => c.charCodeAt(0))],
                          { type: 'image/png' },
                        ),
                        'alliancelab-qr-' + (part + 1) + '.png',
                      )
                    }
                  >
                    Save this QR image
                    <Download size={14} />
                  </button>
                </div>
                <details>
                  <summary>Transfer text for this frame</summary>
                  <textarea aria-label="QR frame text" rows={4} readOnly value={parts[part]} />
                  <p className="hint">
                    Copy this into the receiver’s frame-text box if a camera is unavailable.
                  </p>
                </details>
              </div>
            ) : (
              <div className="qr-placeholder">
                <QrCode size={56} />
                <p>Your transfer frames will appear here.</p>
              </div>
            )}
            <p className="hint">
              Large events may need many frames. JSON files are the quickest way to share a complete
              workspace. QR checksums detect incomplete or damaged transfers; they do not
              authenticate the sender.
            </p>
          </section>
          <section className="panel">
            <PanelTitle
              title="Receive observations"
              description="Scan every frame, in any order."
              action={
                <button className="text-button" onClick={resetReceiver}>
                  <RotateCcw size={14} />
                  Reset
                </button>
              }
            />
            <Scanner onCode={scan} />
            {receiver && (
              <div className="transfer-progress">
                <Tag tone="green">
                  {Object.keys(receiver.parts).length} / {receiver.total} frames received
                </Tag>
                <progress
                  aria-label="QR transfer progress"
                  value={Object.keys(receiver.parts).length}
                  max={receiver.total}
                />
              </div>
            )}
            <details className="paste-transfer">
              <summary>Paste a frame’s transfer text</summary>
              <label>
                <span className="sr-only">Received QR frame text</span>
                <textarea
                  rows={4}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder="AL1:…"
                />
              </label>
              <button
                className="button secondary"
                disabled={!paste.trim()}
                onClick={() => {
                  lastScan.current = '';
                  scan(paste.trim());
                  setPaste('');
                }}
              >
                Add frame
              </button>
            </details>
            {scanError && (
              <p className="error" role="alert">
                {scanError}
              </p>
            )}
          </section>
        </div>
      )}
      {incoming && (
        <Modal title="Review your import" onClose={() => setIncoming(null)}>
          <div className="stack">
            <p className="muted">
              Exported {new Date(incoming.exportedAt).toLocaleString()}. Review the source before
              adding observations to your workspace.
            </p>
            <div className="backup-counts">
              <span>
                <strong>{incoming.data.events.length}</strong> events
              </span>
              <span>
                <strong>{incoming.data.matches.length}</strong> observations
              </span>
              <span>
                <strong>{incoming.data.pits.length}</strong> pit notes
              </span>
            </div>
            <div className="import-events">
              {incoming.data.events.map((e) => (
                <div key={e.id}>
                  <strong>{e.name}</strong>
                  <Tag tone={e.demo ? 'amber' : ''}>
                    {e.demo ? 'Demo data' : e.season + ' event'}
                  </Tag>
                </div>
              ))}
            </div>
            <fieldset className="import-modes">
              <legend>How should this data be imported?</legend>
              <label>
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                />
                <span>
                  <strong>Merge into workspace</strong>
                  <small>Add new observations; update only newer revisions.</small>
                </span>
              </label>
              {incoming.kind === 'workspace' && (
                <label>
                  <input
                    type="radio"
                    name="importMode"
                    checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                  />
                  <span>
                    <strong>Replace workspace from backup</strong>
                    <small>
                      Current events, observations, and drafts will be replaced. Export a backup
                      first.
                    </small>
                  </span>
                </label>
              )}
            </fieldset>
            {mode === 'merge' && preview && (
              <div className="notice subtle">
                {preview.added} new records · {preview.updated} updates · {preview.skipped}{' '}
                unchanged records
              </div>
            )}
            {previewError && (
              <p className="error" role="alert">
                {previewError}
              </p>
            )}
            {mode === 'replace' && (
              <p className="error">
                This replaces all {workspace.data.events.length} current events and{' '}
                {workspace.data.matches.length} match observations.
              </p>
            )}
            <div className="form-actions">
              <button className="button secondary" onClick={() => setIncoming(null)}>
                Cancel
              </button>
              <button
                disabled={mode === 'merge' && !preview}
                className={'button ' + (mode === 'replace' ? 'danger' : 'primary')}
                onClick={apply}
              >
                {mode === 'replace' ? 'Replace workspace' : 'Confirm import'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
