/* Dagsplan — offline cache. Bump VERSION after changing any file so installed devices pick up the new version. */
const VERSION = 'dagsplan-v18';
const FILES = ['./', './index.html', './css/style.css', './js/config.js', './js/lang.js', './js/core.js', './js/store.js', './js/child.js', './js/parent.js', './js/call.js', './js/ntfy.js', './js/app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && /^dagsplan-v\d+$/.test(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;   // the database and sign-in go straight to the network
  // network first so updates arrive; fall back to the cache when offline
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
// tapping a reminder notification brings the child's screen to the front
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './#child';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => {
    for (const c of L) if ('focus' in c) { if (url.includes('#') && 'navigate' in c && !c.url.endsWith(url.slice(url.indexOf('#')))) c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
