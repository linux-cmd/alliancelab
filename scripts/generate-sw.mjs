import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = await readdir('dist/assets');
const precache = ['/index.html', '/icon.svg', '/manifest.webmanifest', ...assets.map(name => '/assets/' + name)];
const version = createHash('sha256').update((await Promise.all(precache.map(p => readFile('dist' + p)))).map(b => b.toString('base64')).join('')).digest('hex').slice(0, 12);
await writeFile('dist/sw.js', `const CACHE='alliancelab-${version}';
const PRECACHE=${JSON.stringify(precache)};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('alliancelab-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html', { ignoreVary: true }))));
  } else if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname, { ignoreVary: true })).then(cached => cached || fetch(event.request)));
  }
});
`);
console.log('Offline shell:', precache.length, 'files, cache', version);
