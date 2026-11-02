/* Dagsplan — start: setting up a family (or joining one with its code), the PIN pad, and which screen this tab shows.
   The address says the screen: #child (the child's screen) or #parent; #child?k=CODE joins a family from a link. */
'use strict';
const App = (() => {
  let cur = null;
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const route = () => { const [r, q] = location.hash.slice(1).split('?'); return { r: r || '', q: new URLSearchParams(q || '') }; };
  const parentOk = code => get('dp-parent-' + code) === '1' || sessionStorage.getItem('dp-parent-' + code) === '1';

  // a few activities and lists to start from, in the chosen language (the parent changes or deletes them)
  function examples() {
    const d = today(), L = { morning: rid(), bag: rid(), swim: rid() };
    const items = a => a.map(([e, t]) => ({ id: rid(6), emoji: e, text: T(t) }));
    const lists = {
      [L.morning]: { title: T('Morning routine'), emoji: '☀️', items: items([['🪥', 'Brush your teeth'], ['👕', 'Get dressed'], ['🥣', 'Eat breakfast'], ['💊', 'Take your medicine']]) },
      [L.bag]: { title: T('School bag'), emoji: '🎒', items: items([['📚', 'Books'], ['✏️', 'Pencil case'], ['🥪', 'Packed lunch'], ['💻', 'Laptop'], ['🥤', 'Water bottle']]) },
      [L.swim]: { title: T('Swimming bag'), emoji: '🏊', items: items([['🩱', 'Swimsuit'], ['🥽', 'Goggles'], ['🧴', 'Shampoo'], ['🧺', 'Towel']]) },
    };
    const A = (title, emoji, cat, start, end, rep, days, more) => ({ title: T(title), emoji, cat, date: d, start, end, repeat: rep, days, remind: 'sound', before: 0, stars: 1, ...more });
    const acts = {};
    for (const a of [
      A('Get up', '☀️', 'home', '07:00', '07:20', 'daily', undefined, { list: L.morning }),
      A('Breakfast', '🥣', 'home', '07:20', '07:40', 'daily'),
      A('Pack the school bag', '🎒', 'school', '07:40', '07:50', 'weekly', '12345', { list: L.bag, note: T('Check the list before you go') }),
      A('School', '🏫', 'school', '08:15', '14:00', 'weekly', '12345', { remind: 'silent', before: 10 }),
      A('Homework', '📚', 'school', '15:30', '16:15', 'weekly', '1234', { stars: 2 }),
      A('Swimming', '🏊', 'training', '17:00', '18:00', 'weekly', '3', { list: L.swim, before: 30 }),
      A('Dinner', '🍽️', 'family', '18:30', '19:00', 'daily'),
      A('Screen off', '📺', 'home', '20:30', '', 'daily', undefined, { stars: 1 }),
      A('Bedtime', '😴', 'home', '21:15', '', 'daily', undefined, { remind: 'sound', before: 15 }),
    ]) { if (!a.days) delete a.days; if (!a.end) delete a.end; acts[rid()] = a; }
    return { acts, lists };
  }

  function langRow() { return `<div class="langs">${Object.entries(LANGS).map(([k, v]) => `<button data-lang="${k}" class="${k === LANG ? 'on' : ''}">${v}</button>`).join('')}</div>`; }
  function setup(step = 'start', err = '') {
    document.body.dataset.role = 'setup';
    const app = $('#app'); app.className = 'setup';
    let h = `<div class="su"><div class="logo">🗓️</div><h1>Dagsplan</h1><p class="muted">${T('A visual day plan with reminders, for the child’s screen and the parent’s phone.')}</p>${langRow()}`;
    if (step === 'start') h += `<button class="btn big" data-su="new">👨‍👩‍👧 ${T('I am a parent: make a new plan')}</button><button class="btn big ghost" data-su="join">🔑 ${T('I have a family code')}</button>`;
    else if (step === 'new') h += `<label>${T('The child’s name')}<input id="su-name" maxlength="30" autocomplete="off"></label>`
      + `<label>${T('Parent PIN (4 digits; opens the parent screen on the child’s device)')}<input id="su-pin" inputmode="numeric" maxlength="8" autocomplete="off"></label>`
      + `<label class="chk"><input type="checkbox" id="su-ex" checked> ${T('Start with examples (morning, school, swimming)')}</label>`
      + `<button class="btn big" data-su="create">${T('Make the plan')}</button><button class="link" data-su="start">${T('Back')}</button>`;
    else if (step === 'join') h += `<label>${T('Family code')}<input id="su-code" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false"></label>`
      + `<button class="btn big" data-su="asChild">🧒 ${T('This is the child’s screen')}</button><button class="btn big ghost" data-su="asParent">👨‍👩‍👧 ${T('I am a parent')}</button><button class="link" data-su="start">${T('Back')}</button>`;
    if (err) h += `<p class="warn">${esc(err)}</p>`;
    if (!Store.cloud) h += `<p class="muted small">${T('Local mode: the plan is kept in this browser only. Add the Firebase settings to sync between devices (see README).')}</p>`;
    app.innerHTML = h + '</div>';
    setup.step = step;
  }
  // the setup page can itself be at #parent or #child, where setting the same hash fires no hashchange
  const go = h => { if (location.hash === h) show(); else location.hash = h; };
  async function onSetup(b) {
    const s = b.dataset.su;
    if (s === 'new' || s === 'join' || s === 'start') { setup(s); return; }
    if (s === 'create') {
      const name = $('#su-name').value.trim(), pin = $('#su-pin').value.trim();
      if (!name) { setup('new', T('Write the child’s name')); return; }
      if (!/^\d{4,8}$/.test(pin)) { const v = name; setup('new', T('The PIN must be 4–8 digits')); $('#su-name').value = v; return; }
      const code = rid(12), ex = $('#su-ex').checked;
      b.disabled = true;
      put('dp-code', code); put('dp-parent-' + code, '1');
      Store.open(code);
      Store.set('settings', { child: name, pin: await pinHash(code, pin), goal: 20, created: Date.now() });
      if (ex) { const e = examples(); Store.set('acts', e.acts); Store.set('lists', e.lists); }
      go('#parent'); return;
    }
    if (s === 'asChild' || s === 'asParent') {
      const code = $('#su-code').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (code.length < 12) { setup('join', T('The code has 12 letters and digits')); return; }
      let ok = false; try { ok = await Store.exists(code); } catch (e) { setup('join', T('No connection — try again')); return; }
      if (!ok) { setup('join', T('No family has this code')); $('#su-code').value = code; return; }
      if (s === 'asParent') {
        const set = await Store.fetchSettings(code);
        if (!(await askPin(code, set && set.pin))) return;
        put('dp-parent-' + code, '1');
      }
      put('dp-code', code); Store.open(code); go(s === 'asChild' ? '#child' : '#parent');
    }
  }

  /* ---- the PIN pad (resolves true when the right PIN is typed) ---- */
  function askPin(code = Store.code, hash = (Store.data.settings || {}).pin) {
    return new Promise(done => {
      if (!hash) { done(true); return; }
      const p = document.createElement('div'); p.className = 'pinpad'; let v = '';
      const draw = (bad) => { p.innerHTML = `<div class="pp-in${bad ? ' bad' : ''}"><h2>${T('Parent PIN')}</h2><div class="pp-dots">${'●'.repeat(v.length) || '&nbsp;'}</div><div class="pp-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '✕', 0, '⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div><button class="link" data-k="ok">${T('OK')}</button></div>`; };
      const finish = r => { p.remove(); done(r); };
      p.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k;
        if (k === '✕') return finish(false);
        if (k === '⌫') { v = v.slice(0, -1); draw(); return; }
        if (k !== 'ok') { if (v.length < 8) v += k; draw(); }
        if (v.length >= 4 && (await pinHash(code, v)) === hash) { sessionStorage.setItem('dp-parent-' + code, '1'); return finish(true); }
        if (k === 'ok' || v.length >= 8) { v = ''; draw(true); }
      });
      draw(); document.body.appendChild(p);
    });
  }

  async function show() {
    const { r, q } = route();
    const k = (q.get('k') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (k && k !== get('dp-code')) { put('dp-code', k); location.replace('#' + (r || 'child')); location.reload(); return; }
    const code = get('dp-code');
    if (cur) { cur.stop(); cur = null; }
    if (!code) { setup(); return; }
    if (Store.code !== code) Store.open(code);
    if (r === 'parent') {
      if (!parentOk(code)) {
        // the PIN from the database when this device has not got the plan yet
        let h = (Store.data.settings || {}).pin; if (!h) try { h = ((await Store.fetchSettings(code)) || {}).pin; } catch (e) {}
        if (!(await askPin(code, h))) { location.hash = '#child'; return; }
      }
      put('dp-role', 'parent'); cur = Parent;
    } else if (r === 'child') { put('dp-role', 'child'); cur = Child; }
    else { location.replace('#' + (get('dp-role') || 'child')); return; }
    cur.start();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lang) { setLang(b.dataset.lang); setup(setup.step); return; }
    if (b.dataset.su) onSetup(b);
  });
  return {
    askPin,
    leave() { const c = get('dp-code'); put('dp-code', null); put('dp-role', null); put('dp-parent-' + c, null); location.hash = ''; location.reload(); },
    start() {
      setLang(LANG);
      addEventListener('hashchange', show);
      show();
      if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    },
  };
})();
App.start();
