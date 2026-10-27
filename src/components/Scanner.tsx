import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, ImagePlus } from 'lucide-react';

export default function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const callback = useRef(onCode); callback.current = onCode;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!running) return;
    let stopped = false, stream: MediaStream | null = null, timer: ReturnType<typeof setTimeout> | undefined;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS and a supported browser. Import a QR image or backup file instead.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 720 } }, audio: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        video.current!.srcObject = stream; await video.current!.play();
        function scan() {
          if (stopped) return;
          const v = video.current, c = canvas.current;
          if (v && c && v.readyState >= 2 && v.videoWidth) {
            c.width = 640; c.height = Math.round(640 * v.videoHeight / v.videoWidth);
            const ctx = c.getContext('2d', { willReadFrequently: true });
            if (ctx) { ctx.drawImage(v, 0, 0, c.width, c.height); const data = ctx.getImageData(0, 0, c.width, c.height); const code = jsQR(data.data, c.width, c.height, { inversionAttempts: 'dontInvert' }); if (code) callback.current(code.data); }
          }
          timer = setTimeout(scan, 180);
        }
        scan();
      } catch (err) { if (!stopped) { setError(err instanceof Error ? err.message : 'Camera access failed. Try importing a QR image.'); setRunning(false); } }
    }
    void start();
    return () => { stopped = true; if (timer) clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [running]);
  async function image(file: File) {
    setError('');
    try {
      if (file.size > 10_000_000) throw new Error('Choose an image smaller than 10 MB.');
      const bitmap = await createImageBitmap(file);
      try {
        const c = canvas.current!, ctx = c.getContext('2d', { willReadFrequently: true })!;
        const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)); c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
        ctx.drawImage(bitmap, 0, 0, c.width, c.height);
        const pixels = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(pixels.data, c.width, c.height);
        if (!code) throw new Error('No readable QR code found. Use a clear, uncropped image.');
        callback.current(code.data);
      } finally { bitmap.close(); }
    } catch (err) { setError(err instanceof Error ? err.message : 'The image could not be read.'); }
  }
  return <div className="scanner"><div className={'camera-view ' + (running ? 'running' : '')}><video ref={video} playsInline muted aria-label="QR scanner camera"/>{!running && <div><Camera size={29}/><p>Point your camera at an AllianceLab QR code.</p><span>Camera frames stay on this device.</span></div>}{running && <span className="camera-guide"/>}</div><canvas ref={canvas} hidden/><div className="button-row"><button className="button secondary" type="button" onClick={() => { setError(''); setRunning(!running); }}>{running ? <CameraOff size={16}/> : <Camera size={16}/>} {running ? 'Stop camera' : 'Start camera'}</button><label className="button secondary file-label"><ImagePlus size={16}/>QR image<input className="sr-only" type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) void image(file); e.target.value = ''; }}/></label></div>{error && <p className="error" role="alert">{error}</p>}</div>;
}
