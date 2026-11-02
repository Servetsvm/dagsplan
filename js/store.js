/* Dagsplan — the family's data, synced live. One family = one tree at f/<code> in the Firebase Realtime Database:
     settings  { child, pin (hash), goal, ft (first–then), msg (a message to the child) }
     acts/<id> { title, emoji, img, cat, date, repeat (none|daily|weekly), days ('135'), until, start, end,
                 remind (sound|voice|silent|none), before (minutes), note, audio, video, list, stars, skip {date:true} }
     lists/<id> { title, emoji, items [ { id, text, emoji, img } ] }
     log/<date>/<actId or 'l_'+listId> { done, seen, ticks {itemId: time} }
   The database is used through its web address only (REST + EventSource), with a hidden guest sign-in as in Bridge.
   Without a Firebase config the tree is kept in this browser (local mode) and the tabs tell each other of changes. */
'use strict';
const Store = (() => {
  const cloud = !!(FIREBASE.apiKey && FIREBASE.databaseURL);
  const DB = cloud ? FIREBASE.databaseURL.replace(/\/+$/, '') : '';
  const subs = new Set();
  const S = { cloud, code: null, data: {}, status: cloud ? 'connecting' : 'local', es: null, bc: null, queue: [] };
  const clone = v => v == null ? null : JSON.parse(JSON.stringify(v));
  function applyAt(root, path, v) {
    const ks = String(path).split('/').filter(Boolean);
    if (!ks.length) return v && typeof v === 'object' ? v : {};
    let o = root;
    for (const k of ks.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
    if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v;
    return root;
  }
  const emit = () => { for (const f of subs) { try { f(S.data); } catch (e) { console.error(e); } } };
  const cacheKey = () => 'dp-data-' + S.code;
  const saveCache = () => { try { localStorage.setItem(cacheKey(), JSON.stringify(S.data)); } catch (e) {} };

  /* the hidden guest account (Firebase anonymous sign-in, no password); its refresh token is kept on the device */
  const Auth = {
    tok: null, exp: 0, p: null,
    async token(force) {
      if (!force && this.tok && Date.now() < this.exp - 60e3) return this.tok;
      return this.p || (this.p = this.fresh().finally(() => { this.p = null; }));
    },
    async fresh() {
      let rt = null; try { rt = localStorage.getItem('dp-auth-rt'); } catch (e) {}
      const keep = (tok, ref, sec) => { this.tok = tok; this.exp = Date.now() + (+sec || 3600) * 1000; try { localStorage.setItem('dp-auth-rt', ref); } catch (e) {} return tok; };
      if (rt) {
        try {
          const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + FIREBASE.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt) });
          if (r.ok) { const d = await r.json(); return keep(d.id_token, d.refresh_token, d.expires_in); }
        } catch (e) {}
      }
      const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + FIREBASE.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' });
      if (!r.ok) throw new Error('auth ' + r.status);
      const d = await r.json(); return keep(d.idToken, d.refreshToken, d.expiresIn);
    },
  };
  async function req(path, method, body, retry) {
    const tok = await Auth.token(retry);
    const r = await fetch(DB + '/f/' + S.code + (path ? '/' + path : '') + '.json?auth=' + tok, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 401 && !retry) return req(path, method, body, true);
    if (!r.ok) throw new Error('db ' + r.status);
    return r.json();
  }
  // writes made while offline wait in a queue (kept on the device) and go out when the connection is back
  const saveQueue = () => { try { localStorage.setItem('dp-queue-' + S.code, JSON.stringify(S.queue)); } catch (e) {} };
  async function flush() {
    while (S.queue.length && navigator.onLine) {
      const [m, p, v] = S.queue[0];
      try { await req(p, m, m === 'DELETE' ? undefined : v); } catch (e) { setTimeout(flush, 8000); return; }
      S.queue.shift(); saveQueue();
    }
  }
  // the live line: the database sends the whole tree first, then every change as it happens
  async function connect() {
    if (S.es) { S.es.close(); S.es = null; }
    let tok; try { tok = await Auth.token(true); } catch (e) { S.status = 'offline'; emit(); setTimeout(connect, 10000); return; }
    const es = S.es = new EventSource(DB + '/f/' + S.code + '.json?auth=' + tok);
    const on = (ev, f) => es.addEventListener(ev, e => { try { f(JSON.parse(e.data)); } catch (x) { console.error(x); } });
    on('put', m => { S.data = m.path === '/' ? (m.data || {}) : applyAt(S.data, m.path, m.data); S.status = 'live'; saveCache(); emit(); });
    on('patch', m => { for (const [k, v] of Object.entries(m.data || {})) applyAt(S.data, m.path.replace(/\/$/, '') + '/' + k, v); saveCache(); emit(); });
    es.addEventListener('auth_revoked', () => connect());
    es.addEventListener('cancel', () => { S.status = 'denied'; emit(); });
    es.onerror = () => { if (S.status !== 'offline') { S.status = 'offline'; emit(); } if (es.readyState === 2) setTimeout(() => S.es === es && connect(), 5000); };
    clearTimeout(S.renew); S.renew = setTimeout(connect, 50 * 60e3);   // a new token before the old one runs out
  }
  function write(method, path, v) {
    // the change shows here at once; the database (or the other tabs) get it next
    if (method === 'PATCH') for (const [k, x] of Object.entries(v)) applyAt(S.data, path + '/' + k, clone(x));
    else applyAt(S.data, path, method === 'DELETE' ? null : clone(v));
    saveCache(); emit();
    if (!cloud) { if (S.bc) S.bc.postMessage('changed'); return; }
    S.queue.push([method, path, v]); saveQueue(); flush();
  }
  return {
    get cloud() { return cloud; }, get code() { return S.code; }, get data() { return S.data; }, get status() { return S.status; },
    on(f) { subs.add(f); return () => subs.delete(f); },
    open(code) {
      S.code = code;
      try { S.data = JSON.parse(localStorage.getItem(cacheKey())) || {}; } catch (e) { S.data = {}; }
      try { S.queue = JSON.parse(localStorage.getItem('dp-queue-' + code)) || []; } catch (e) { S.queue = []; }
      if (cloud) { connect(); flush(); addEventListener('online', () => { flush(); connect(); }); }
      else if ('BroadcastChannel' in window) {
        S.bc = new BroadcastChannel('dp-' + code);
        S.bc.onmessage = () => { try { S.data = JSON.parse(localStorage.getItem(cacheKey())) || {}; } catch (e) {} emit(); };
      }
      emit();
    },
    // does a family with this code exist? (local mode: in this browser)
    async exists(code) {
      if (!cloud) return !!localStorage.getItem('dp-data-' + code);
      const tok = await Auth.token(); const r = await fetch(DB + '/f/' + code + '/settings/child.json?auth=' + tok);
      return r.ok && (await r.json()) != null;
    },
    async fetchSettings(code) {
      if (!cloud) { try { return (JSON.parse(localStorage.getItem('dp-data-' + code)) || {}).settings || null; } catch (e) { return null; } }
      const tok = await Auth.token(); const r = await fetch(DB + '/f/' + code + '/settings.json?auth=' + tok);
      return r.ok ? r.json() : null;
    },
    set: (path, v) => write('PUT', path, v),
    update: (path, obj) => write('PATCH', path, obj),
    remove: path => write('DELETE', path),
  };
})();
