/* 極（きわみ） service worker, at the site's root (scope /): the app (/app/) works offline after the first visit, and the site's
   pages (the home /, /ranking/…) open offline once seen.
   - the pages: network first, so a new version arrives as soon as you are online; on a weak signal (no answer in 3 s)
     the saved page opens. Whatever the network answers in
     time is what opens, a 404 or other error page included (no saved home in place of a page that is not there).
     A page not in PAGES (a ranking…) is saved when it arrives, late or not. PAGES (the home, the app) are saved at install
     only, together with the data the app's page names; a newer app page whose data are not all saved yet does not open,
     the saved one does (page and data are always of one version)
   - audio sprites (words sNNN, example sentences eNNN): cached on first play (the words also all at once from 設定).
     A sprite file never changes (tools/pack_*.py put new audio in new files), so this cache keeps one name and is never cleared
   - the login / sync library (Firebase, one fixed version): cached on first use, so an offline start still syncs later
   - Google Fonts: served from cache, refreshed in the background
   - the page's data (d/: each deck, the audio indexes…): named by a hash of what they hold, so a file never changes; saved
     at install, served from the cache, and a file the current page no longer names is dropped */
const APP = 'kyokutan-app-fdd7e0684b';
const AUDIO = 'kyokutan-audio';
const AUDIO_OLD = 'kyokutan-audio-f026ca2bc4';   // the last name that changed with the audio set: the same files, so they move over
const FONTS = 'kyokutan-fonts-v1';
const DATA = 'kyokutan-data';
const DATA_FILES = ["./d/deck_j1.cbcdf10127.js", "./d/deck_j2.52401eff3d.js", "./d/deck_j3.4d64e247a1.js", "./d/deck_idioms.48ae0fd647.js", "./d/deck_toeic.fdb09144f2.js", "./d/deck_junior.b556b0c816.js", "./d/deck_tagi.e54ab562d5.js", "./d/deck_theme.0b9def073b.js", "./d/aud.68434beab2.js", "./d/exi.44c8b1f9bf.js", "./d/mekuru.80e52ef710.js", "./d/extra.dc919d4053.js"];
const LIB = 'kyokutan-lib-10.12.2';
const PAGE_WAIT = 3000;
const PAGES = ["./", "./app/"];   // the pages saved at install (the site's home and the app at ./app/; build.py fills it in)
const SHELL = [...PAGES, './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([caches.open(APP).then(c => Promise.all([   // the pages: asked of the server (a copy the browser kept could be the page before this version's data), not saved yet
    Promise.all(PAGES.map(p => fetch(p, {cache: 'no-cache'}))), c.addAll(SHELL.slice(PAGES.length))]).then(r => r[0])), caches.open(DATA).then(async c => {
    const have = new Set((await c.keys()).map(r => new URL(r.url).pathname.split('/').pop()));
    await c.addAll(DATA_FILES.filter(f => !have.has(f.split('/').pop())));   // only the files this version added
  })]).then(async ([got]) => {
    // the pages name exactly this version's data files, or nothing is saved (caught mid-publish: the next check installs it)
    const named = new Set((await Promise.all(got.map(r => r.clone().text()))).flatMap(dataOf));
    if (got.some(r => !r.ok) || named.size !== DATA_FILES.length || !DATA_FILES.every(f => named.has(f.split('/').pop()))) throw new Error('page and data of different versions');
    const c = await caches.open(APP);
    await Promise.all(PAGES.map((p, i) => c.put(p, got[i])));
  }).then(() => self.skipWaiting()));
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

/* the data files (d/) a page names (build.py's <script src="d/…"> tags), and whether they are all saved */
const dataOf = html => [...html.matchAll(/<script src="(?:\.\.\/)?d\/([^"]+)"/g)].map(m => m[1]);
async function hasData(res) {
  const have = new Set((await (await caches.open(DATA)).keys()).map(r => new URL(r.url).pathname.split('/').pop()));
  return dataOf(await res.clone().text()).every(f => have.has(f));
}
const ownPage = url => { const p = new URL(url).pathname.replace(/index\.html$/, ''); return PAGES.some(q => new URL(q, self.registration.scope).pathname === p); };

/* the page from the network, saved for next time; the event stays alive until it is saved even if the cache answered first.
   Not PAGES: saved here, a new app page would sit beside the old version's data until every new file had come (a deck
   gone from the app when offline); install saves them, once this version's data are all in */
function fetchPage(e) {
  let saved;
  const net = fetch(e.request, {cache: 'no-cache'}).then(res => {   // revalidate, so a new version is never held back by the HTTP cache
    if (res.ok && !ownPage(e.request.url)) { const copy = res.clone(); saved = caches.open(APP).then(c => c.put(e.request, copy)); }
    return res;
  });
  e.waitUntil(net.then(() => saved, () => {}).catch(() => {}));
  return net;
}

async function networkFirst(req, net) {
  const c = await caches.open(APP);
  // the saved copy of this page (with or without its ?query), else the saved page it belongs under (the app for /app/…, else the home)
  const path = new URL(req.url).pathname, base = PAGES.map(p => new URL(p, self.registration.scope).pathname).filter(p => path.startsWith(p)).sort((a, b) => b.length - a.length)[0];
  const hit = (await c.match(req)) || (await c.match(req, {ignoreSearch: true})) || (base && (await c.match(base))) || (await c.match('./')) || (await c.match('./index.html'));
  if (!hit) return net.catch(() => Response.error());
  const late = new Promise(r => setTimeout(r, PAGE_WAIT, null));
  try {
    const res = await Promise.race([ownPage(req.url) ? net.then(async r => !r.ok || await hasData(r) || !await hasData(hit) ? r : null) : net, late]);
    return res || hit;                               // the network's answer, even a 404; no answer within 3 s, or an app page ahead of its data: the saved page
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
