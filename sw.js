/* 極（きわみ） service worker: the app works offline after the first visit.
   - the page: network first, so a new version arrives as soon as you are online; on a weak signal (no answer in 3 s)
     the saved page opens, and the download carries on in the background for next time
   - audio sprites (words sNNN, example sentences eNNN): cached on first play (the words also all at once from 設定).
     A sprite file never changes (tools/pack_*.py put new audio in new files), so this cache keeps one name and is never cleared
   - the login / sync library (Firebase, one fixed version): cached on first use, so an offline start still syncs later
   - Google Fonts: served from cache, refreshed in the background
   - the page's data (d/: each deck, the audio indexes…): named by a hash of what they hold, so a file never changes; saved
     at install, served from the cache, and a file the current page no longer names is dropped */
const APP = 'kyokutan-app-119cbe5ae7';
const AUDIO = 'kyokutan-audio';
const AUDIO_OLD = 'kyokutan-audio-f026ca2bc4';   // the last name that changed with the audio set: the same files, so they move over
const FONTS = 'kyokutan-fonts-v1';
const DATA = 'kyokutan-data';
const DATA_FILES = ["./d/deck_j1.f688abaefa.js", "./d/deck_j2.cc616c09c9.js", "./d/deck_j3.8e221f6bd2.js", "./d/deck_idioms.d32c42de25.js", "./d/deck_toeic.c1c4b899bf.js", "./d/deck_junior.b556b0c816.js", "./d/deck_tagi.e54ab562d5.js", "./d/deck_theme.2435bcc8fb.js", "./d/aud.2708c763ee.js", "./d/exi.dd85173111.js", "./d/mekuru.80e52ef710.js", "./d/extra.8d13f92ebd.js"];
const LIB = 'kyokutan-lib-10.12.2';
const PAGE_WAIT = 3000;
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([caches.open(APP).then(c => c.addAll(SHELL)), caches.open(DATA).then(async c => {
    const have = new Set((await c.keys()).map(r => new URL(r.url).pathname.split('/').pop()));
    await c.addAll(DATA_FILES.filter(f => !have.has(f.split('/').pop())));   // only the files this version added
  })]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    if ((await caches.keys()).includes(AUDIO_OLD)) {
      const from = await caches.open(AUDIO_OLD), to = await caches.open(AUDIO);
      for (const req of await from.keys()) { const res = await from.match(req); if (res) await to.put(req, res); }
    }
    for (const k of await caches.keys()) if (k.startsWith('kyokutan-') && ![APP, AUDIO, FONTS, LIB, DATA].includes(k)) await caches.delete(k);
    const keep = new Set(DATA_FILES.map(f => f.split('/').pop())), dc = await caches.open(DATA);
    for (const r of await dc.keys()) if (!keep.has(new URL(r.url).pathname.split('/').pop())) await dc.delete(r);
    await self.clients.claim();
  })());
});

async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}

/* the page from the network, saved for next time; the event stays alive until it is saved even if the cache answered first */
function fetchPage(e) {
  let saved;
  const net = fetch(e.request, {cache: 'no-cache'}).then(res => {   // revalidate, so a new version is never held back by the HTTP cache
    if (res.ok) { const copy = res.clone(); saved = caches.open(APP).then(c => c.put(e.request, copy)); }
    return res;
  });
  e.waitUntil(net.then(() => saved, () => {}).catch(() => {}));
  return net;
}

async function networkFirst(req, net) {
  const c = await caches.open(APP);
  const hit = (await c.match(req)) || (await c.match('./')) || (await c.match('./index.html'));
  if (!hit) return net.catch(() => Response.error());
  const late = new Promise(r => setTimeout(r, PAGE_WAIT, null));
  try {
    const res = await Promise.race([net, late]);
    return res && res.ok ? res : hit;                // no answer within 3 s, or an error page: the saved page
  } catch (err) {
    return hit;
  }
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(FONTS);
  const hit = await c.match(req);
  const update = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || update;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return e.respondWith(staleWhileRevalidate(req));
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) return e.respondWith(cacheFirst(req, LIB));
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) return e.respondWith(networkFirst(req, fetchPage(e)));
  if (url.pathname.includes('/audio/')) return e.respondWith(cacheFirst(req, AUDIO));
  if (url.pathname.includes('/d/')) return e.respondWith(cacheFirst(req, DATA));
  e.respondWith(cacheFirst(req, APP));
});
