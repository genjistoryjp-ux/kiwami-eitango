/* 極（きわみ） service worker: the app works offline after the first visit.
   - the page: network first, so a new version arrives as soon as you are online; on a weak signal (no answer in 3 s)
     the saved page opens, and the download carries on in the background for next time
   - audio sprites (words sNNN, example sentences eNNN): cached on first play (the words also all at once from 設定).
     A sprite file never changes (tools/pack_*.py put new audio in new files), so this cache keeps one name and is never cleared
   - the login / sync library (Firebase, one fixed version): cached on first use, so an offline start still syncs later
   - Google Fonts: served from cache, refreshed in the background */
const APP = 'kyokutan-app-8ec0f65f4e';
const AUDIO = 'kyokutan-audio';
const AUDIO_OLD = 'kyokutan-audio-f026ca2bc4';   // the last name that changed with the audio set: the same files, so they move over
const FONTS = 'kyokutan-fonts-v1';
const LIB = 'kyokutan-lib-10.12.2';
const PAGE_WAIT = 3000;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    if ((await caches.keys()).includes(AUDIO_OLD)) {
      const from = await caches.open(AUDIO_OLD), to = await caches.open(AUDIO);
      for (const req of await from.keys()) { const res = await from.match(req); if (res) await to.put(req, res); }
    }
    for (const k of await caches.keys()) if (k.startsWith('kyokutan-') && ![APP, AUDIO, FONTS, LIB].includes(k)) await caches.delete(k);
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
  const hit = (await c.match(req)) || (await c.match('./index.html'));
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
  e.respondWith(cacheFirst(req, APP));
});
