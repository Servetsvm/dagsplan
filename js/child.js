/* Dagsplan — the child's screen: the clock, today's plan with a "now" line, the countdown and time pie, full-screen
   reminders, checklists, the week, stars and first–then. Nothing here can be edited; a parent opens the parent screen
   by holding the clock for 3 seconds and typing the PIN. */
'use strict';
const Child = (() => {
  const st = { tab: 'today', open: null, alerts: [], alertNow: null, alertTimer: null, started: false, lock: null, last: '' };
  const D = () => Store.data;
  const S = () => D().settings || {};

  // the part of the day in words (helps to feel where in the day we are)
  function dayPart(m) { return m < 300 ? T('night') : m < 600 ? T('morning') : m < 720 ? T('late morning') : m < 1080 ? T('afternoon') : m < 1380 ? T('evening') : T('night'); }
  function clockSvg() {
    let marks = ''; for (let i = 0; i < 12; i++) marks += `<line x1="50" y1="${i % 3 ? 9 : 7}" x2="50" y2="${i % 3 ? 13 : 16}" transform="rotate(${i * 30} 50 50)"/>`;
    return `<svg class="aclock" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" class="face"/><g class="marks">${marks}</g>`
      + `<line id="hh" x1="50" y1="50" x2="50" y2="27" class="hh"/><line id="mh" x1="50" y1="50" x2="50" y2="15" class="mh"/><line id="sh" x1="50" y1="56" x2="50" y2="12" class="sh"/><circle cx="50" cy="50" r="3" class="dot"/></svg>`;
  }
  function tickClock() {
    const d = new Date(), s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    const set = (id, deg) => { const el = document.getElementById(id); if (el) el.setAttribute('transform', `rotate(${deg} 50 50)`); };
    set('hh', h * 30); set('mh', m * 6); set('sh', s * 6);
    const t = $('#c-time'); if (t) t.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---- the "now / next" band: the running activity with its shrinking pie, else a countdown to the next one ---- */
  function nowHtml(acts, n) {
    const cur = acts.filter(a => a.end && mins(a.start) <= n && n < mins(a.end) && !logOf(D(), today(), a.id).done);
    const next = acts.find(a => mins(a.start) > n);
    let h = '';
    for (const a of cur) {
      const s = mins(a.start), e = mins(a.end), c = catOf(a).c;
      h += `<button class="now-card" data-open="${a.id}" style="--c:${c}">${pie((e - n) / (e - s), c, 84)}<div class="nc-txt"><div class="nc-lbl">${T('Now')}</div><div class="nc-title">${pic(a, 'sm')} ${esc(a.title)}</div><div class="nc-left">${T('{0} left', dur(e - n))}</div></div></button>`;
    }
    if (next) {
      const left = mins(next.start) - n, c = catOf(next).c;
      h += `<button class="now-card next" data-open="${next.id}" style="--c:${c}">${pie(Math.min(left, 60) / 60, c, cur.length ? 56 : 84)}<div class="nc-txt"><div class="nc-lbl">${T('Next')}</div><div class="nc-title">${pic(next, 'sm')} ${esc(next.title)}</div><div class="nc-left">${T('in {0}', dur(left))} · ${next.start}</div></div></button>`;
    }
    if (!h) h = `<div class="now-card done"><span class="big-emo">🌙</span><div class="nc-txt"><div class="nc-title">${acts.length ? T('No more activities today') : T('Nothing planned today')}</div></div></div>`;
    return h;
  }
  function statusIcon(a, d, n) {
    const L = logOf(D(), d, a.id);
    if (L.done) return '<span class="st ok" title="">✓</span>';
    if (a.end && mins(a.start) <= n && n < mins(a.end)) return '<span class="st run">▶</span>';
    return '';
  }
  function todayHtml(acts, n) {
    if (!acts.length) return `<div class="empty">${T('Nothing planned today')}</div>`;
    const d = today(); let h = '<div class="timeline">', lined = false;
    const line = () => `<div class="nowline"><span>${hm(n)}</span></div>`;
    for (const a of acts) {
      const s = mins(a.start), past = (a.end ? mins(a.end) : s + 1) <= n;
      if (!lined && s > n) { h += line(); lined = true; }
      const L = itemsOf(listOf(D(), a.list)), ticks = logOf(D(), d, a.id).ticks || {};
      h += `<button class="tl-item${past ? ' past' : ''}${logOf(D(), d, a.id).done ? ' isdone' : ''}" data-open="${a.id}" style="--c:${catOf(a).c}">`
        + `<div class="tl-time">${a.start}${a.end ? '<small>' + a.end + '</small>' : ''}</div>${pic(a)}<div class="tl-title">${esc(a.title)}`
        + `${L.length ? `<small>☑ ${L.filter(i => ticks[i.id]).length}/${L.length}</small>` : ''}</div>${statusIcon(a, d, n)}</button>`;
    }
    if (!lined) h += line();
    return h + '</div>';
  }
  function listsHtml() {
    const ls = Object.entries(D().lists || {});
    if (!ls.length) return `<div class="empty">${T('No checklists yet')}</div>`;
    const d = today();
    return '<div class="tiles">' + ls.map(([id, l]) => {
      const it = itemsOf(l), tk = logOf(D(), d, 'l_' + id).ticks || {}, n = it.filter(i => tk[i.id]).length;
      return `<button class="tile" data-list="${id}">${pic(l, 'lg')}<b>${esc(l.title)}</b><small>${n}/${it.length}${n === it.length && it.length ? ' ✓' : ''}</small></button>`;
    }).join('') + '</div>';
  }
  function ftHtml() {
    const f = S().ft; if (!f) return `<div class="empty">${T('Nothing here yet')}</div>`;
    const done = f.firstDone;
    return `<div class="ft"><button class="ft-card${done ? ' did' : ''}" id="ft-first"><div class="ft-lbl">${T('First')}</div><span class="big-emo">${esc(f.first.emoji || '✅')}</span><b>${esc(f.first.text)}</b>${done ? '<div class="ft-ok">✓</div>' : ''}</button>`
      + `<div class="ft-arrow">➜</div><div class="ft-card then${done ? ' glow' : ''}"><div class="ft-lbl">${T('Then')}</div><span class="big-emo">${esc(f.then.emoji || '🎉')}</span><b>${esc(f.then.text)}</b></div></div>`;
  }
  function render() {
    const app = $('#app'), d = today(), n = nowMin(), acts = dayActs(D(), d), s = S();
    const goal = +s.goal || 0, stars = weekStars(D(), d);
    const tabs = [['today', '📅', T('Today')], ['week', '🗓️', T('Week')], ['lists', '☑️', T('Lists')]];
    if (s.ft) tabs.push(['ft', '➜', T('First – then')]);
    if (st.tab === 'ft' && !s.ft) st.tab = 'today';
    let main = '';
    if (st.tab === 'today') main = `<section class="now">${nowHtml(acts, n)}</section>` + todayHtml(acts, n);
    else if (st.tab === 'week') main = weekHtml(D(), mondayOf(d), false);
    else if (st.tab === 'lists') main = listsHtml();
    else main = ftHtml();
    app.className = 'child';
    app.innerHTML = `<header class="c-top"><div class="c-clock" id="hold">${clockSvg()}<div><div class="c-time" id="c-time"></div><div class="c-date">${esc(dateLong(d))}</div><div class="c-part">${esc(dayPart(n))}</div></div></div>`
      + `<div class="c-right">${s.child ? `<div class="c-name">${esc(s.child)}</div>` : ''}<div class="c-stars">⭐ ${stars}${goal ? ' / ' + goal : ''}${goal ? `<div class="bar"><i style="width:${Math.min(100, stars / goal * 100)}%"></i></div>` : ''}</div>`
      + `<button class="c-lang" id="c-lang" aria-label="Language">${LANG.toUpperCase()}</button></div></header>`
      + (Store.status === 'offline' ? `<div class="offline">${T('No connection — showing the last plan')}</div>` : '')
      + `<main class="c-main">${main}</main>`
      + `<nav class="c-nav">${tabs.map(([k, i, t]) => `<button data-tab="${k}" class="${st.tab === k ? 'on' : ''}"><span>${i}</span>${esc(t)}</button>`).join('')}</nav>`;
    tickClock();
    if (st.open) renderOpen(false);
  }

  /* ---- an activity or a checklist opened full screen ---- */
  function openKey() { return st.open && st.open.list ? 'l_' + st.open.list : st.open && st.open.act; }
  function renderOpen(fresh) {
    const ov = $('#ov'), d = today();
    const a = st.open.act ? (D().acts || {})[st.open.act] : null, l = st.open.list ? listOf(D(), st.open.list) : listOf(D(), a && a.list);
    if (!a && !l) { closeOpen(); return; }
    const key = openKey(), lg = logOf(D(), d, key), ticks = lg.ticks || {}, items = itemsOf(l), c = a ? catOf(a).c : '#0ea5e9', n = nowMin();
    let dyn = '';
    if (a && a.end && mins(a.start) <= n && n < mins(a.end)) dyn += `<div class="op-pie">${pie((mins(a.end) - n) / (mins(a.end) - mins(a.start)), c, 96)}<b>${T('{0} left', dur(mins(a.end) - n))}</b></div>`;
    if (items.length) dyn += `<div class="check">${l && a ? `<h3>${pic(l, 'sm')} ${esc(l.title)}</h3>` : ''}` + items.map(i => `<button class="ck${ticks[i.id] ? ' on' : ''}" data-tick="${esc(i.id)}">${pic(i)}<span class="ck-t">${esc(i.text)}</span><i>${ticks[i.id] ? '✓' : ''}</i></button>`).join('') + '</div>';
    if (lg.done) dyn += `<div class="did">✓ ${T('Done at {0}', clockOf(lg.done))} <button class="link" id="undo">${T('Undo')}</button></div>`;
    else dyn += `<button class="btn-done" id="done">${T('Done')} ✓</button>`;
    if (fresh || !$('#op-dyn')) {
      ov.innerHTML = `<div class="op" style="--c:${c}"><button class="x" id="op-x" aria-label="${T('Close')}">✕</button>`
        + `<div class="op-head">${pic(a || l, 'xl')}<div><h2>${esc((a || l).title)}</h2>${a ? `<div class="op-time">${a.start}${a.end ? '–' + a.end : ''}</div>` : ''}</div></div>`
        + (a && a.audio ? `<button class="btn-voice" id="op-voice">🔊 ${T('Listen to the message')}</button>` : '')
        + (a && a.note ? `<div class="op-note">${esc(a.note)}</div>` : '')
        + (a ? videoHtml(a.video) : '') + `<div id="op-dyn"></div></div>`;
      ov.hidden = false;
    }
    $('#op-dyn').innerHTML = dyn;
  }
  function openAct(id) { st.open = { act: id }; renderOpen(true); }
  function openList(id) { st.open = { list: id }; renderOpen(true); }
  function closeOpen() { st.open = null; const ov = $('#ov'); ov.hidden = true; ov.innerHTML = ''; }
  function markDone(key, on) {
    const d = today();
    if (on) { Store.set(`log/${d}/${key}/done`, Date.now()); celebrate(); } else Store.remove(`log/${d}/${key}/done`);
  }
  function tick(itemId) {
    const d = today(), key = openKey(), lg = logOf(D(), d, key), on = !(lg.ticks || {})[itemId];
    if (on) Store.set(`log/${d}/${key}/ticks/${itemId}`, Date.now()); else Store.remove(`log/${d}/${key}/ticks/${itemId}`);
    const a = st.open.act ? (D().acts || {})[st.open.act] : null, items = itemsOf(listOf(D(), st.open.list || (a && a.list)));
    const t = (logOf(D(), d, key).ticks) || {};
    if (on && !lg.done && items.length && items.every(i => t[i.id])) markDone(key, true);
    else if (on) Sound.unlock(), navigator.vibrate && navigator.vibrate(30);
  }

  /* ---- reminders: at the start (or some minutes before) a full-screen card with sound, the parent's recorded voice,
     or silently; it comes back after a reload until the child presses Done (the parent sees when). ---- */
  function checkAlerts() {
    const d = today(), n = nowMin(), keys = new Set(st.alerts.map(x => x.key).concat(st.alertNow ? [st.alertNow.key] : []));
    for (const a of dayActs(D(), d)) {
      if (!a.remind || a.remind === 'none') continue;
      const t = mins(a.start) - (+a.before || 0), key = d + ':' + a.id;
      if (n >= t && n < t + 20 && !logOf(D(), d, a.id).seen && !logOf(D(), d, a.id).done && !keys.has(key)) st.alerts.push({ key, act: a.id, date: d });
    }
    const m = S().msg;
    if (m && m.id && !m.seen && Date.now() - m.ts < 15 * 60e3 && !keys.has('m:' + m.id)) st.alerts.push({ key: 'm:' + m.id, msg: m });
    if (!st.alertNow && st.alerts.length) showAlert(st.alerts.shift());
  }
  function showAlert(al) {
    const a = al.act ? (D().acts || {})[al.act] : null; if (al.act && !a) return;
    st.alertNow = al;
    const box = $('#alert'), c = a ? catOf(a).c : '#0ea5e9', start = a ? mins(a.start) : 0, left = a ? start - nowMin() : 0;
    const title = a ? a.title : al.msg.text, when = a ? (left > 0.5 ? T('in {0}', dur(left)) : T('Now')) + ' · ' + a.start : T('Message from home');
    box.style.setProperty('--c', c);
    box.innerHTML = `<div class="al-in"><div class="al-when">${esc(when)}</div>${a ? pic(a, 'xxl') : `<span class="pic emo xxl">${esc(al.msg.emoji || '💬')}</span>`}<h1>${esc(title)}</h1>`
      + (a && a.note ? `<p>${esc(a.note)}</p>` : '')
      + (a && a.audio ? `<button class="btn-voice" id="al-voice">🔊 ${T('Listen again')}</button>` : '')
      + `<button class="btn-done big" id="al-ok">${T('Done')} ✓</button></div>`;
    box.hidden = false;
    const mode = a ? a.remind : 'sound';
    let n = 0; clearInterval(st.alertTimer);
    const ring = () => { if (mode === 'voice' && a.audio) { if (n < 3) playVoice(a.audio); } else if (mode !== 'silent' && n < 12) Sound.chime(); n++; if (navigator.vibrate && n < 6) navigator.vibrate([300, 150, 300]); };
    ring(); st.alertTimer = setInterval(ring, mode === 'voice' ? 20000 : 5000);
    if (document.hidden) notify(title, when, al.key);
  }
  function ackAlert() {
    const al = st.alertNow; if (!al) return;
    clearInterval(st.alertTimer); stopVoice();
    if (al.act) Store.set(`log/${al.date}/${al.act}/seen`, Date.now()); else Store.set('settings/msg/seen', Date.now());
    st.alertNow = null; $('#alert').hidden = true;
    const a = al.act && (D().acts || {})[al.act];
    if (a && a.list) openAct(al.act);
    setTimeout(checkAlerts, 300);
  }
  let voiceEl = null;
  function playVoice(src) { stopVoice(); voiceEl = new Audio(src); voiceEl.play().catch(() => {}); }
  function stopVoice() { if (voiceEl) { voiceEl.pause(); voiceEl = null; } }
  // a system notification as well, when the app is in the background (the service worker shows it)
  function notify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, tag, renotify: true, requireInteraction: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [300, 150, 300] })).catch(() => {});
  }

  // the start screen: one tap lets the browser play sound, keeps the screen on and goes full screen
  function startGate() {
    const g = $('#gate');
    g.innerHTML = `<div class="gate-in"><div class="logo">🗓️</div><h1>${esc(S().child ? T('Hi {0}!', S().child) : T('Hi!'))}</h1><button class="btn-done big" id="go">${T('Start')}</button>`
      + ('Notification' in window && Notification.permission === 'default' ? `<button class="link" id="notif">${T('Allow notifications')}</button>` : '') + '</div>';
    g.hidden = false;
  }
  async function keepAwake() { try { if ('wakeLock' in navigator && !document.hidden) st.lock = await navigator.wakeLock.request('screen'); } catch (e) {} }

  function onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'go') { Sound.unlock(); keepAwake(); try { if (matchMedia('(pointer:coarse)').matches) document.documentElement.requestFullscreen().catch(() => {}); } catch (x) {} $('#gate').hidden = true; st.started = true; checkAlerts(); return; }
    if (b.id === 'notif') { Notification.requestPermission().then(startGate); return; }
    if (b.dataset.tab) { st.tab = b.dataset.tab; render(); return; }
    if (b.dataset.open) { openAct(b.dataset.open); return; }
    if (b.dataset.list) { openList(b.dataset.list); return; }
    if (b.dataset.tick) { tick(b.dataset.tick); return; }
    if (b.id === 'op-x') { stopVoice(); closeOpen(); return; }
    if (b.id === 'op-voice') { const a = (D().acts || {})[st.open.act]; if (a) playVoice(a.audio); return; }
    if (b.id === 'done') { markDone(openKey(), true); return; }
    if (b.id === 'undo') { markDone(openKey(), false); return; }
    if (b.id === 'al-ok') { ackAlert(); return; }
    if (b.id === 'al-voice') { const a = (D().acts || {})[st.alertNow.act]; if (a) playVoice(a.audio); return; }
    if (b.id === 'ft-first') { const f = S().ft; if (f && !f.firstDone) { Store.set('settings/ft/firstDone', Date.now()); celebrate(); } return; }
    if (b.id === 'c-lang') { const L = Object.keys(LANGS); setLang(L[(L.indexOf(LANG) + 1) % L.length]); render(); return; }
  }
  // hold the clock for 3 seconds: the PIN, then the parent screen
  function onHold(e) {
    if (!e.target.closest('#hold')) return;
    const t = setTimeout(async () => { if (await App.askPin()) location.hash = '#parent'; }, 3000);
    const stop = () => { clearTimeout(t); removeEventListener('pointerup', stop); removeEventListener('pointercancel', stop); };
    addEventListener('pointerup', stop); addEventListener('pointercancel', stop);
  }
  let timers = [], off = null;
  return {
    start() {
      document.body.dataset.role = 'child';
      off = Store.on(() => { render(); checkAlerts(); });
      render();
      document.addEventListener('click', onClick); document.addEventListener('pointerdown', onHold);
      timers.push(setInterval(tickClock, 1000), setInterval(() => { if (st.started) checkAlerts(); }, 5000));
      // the plan, the pies and the "now" line move once a minute
      let lastMin = -1; timers.push(setInterval(() => { const m = new Date().getMinutes(); if (m !== lastMin) { lastMin = m; render(); } }, 2000));
      document.addEventListener('visibilitychange', this.vis = () => { if (!document.hidden) { keepAwake(); render(); checkAlerts(); } });
      if (!st.started) startGate();
    },
    stop() {
      timers.forEach(clearInterval); timers = []; off && off(); clearInterval(st.alertTimer); stopVoice();
      document.removeEventListener('click', onClick); document.removeEventListener('pointerdown', onHold); document.removeEventListener('visibilitychange', this.vis);
      try { st.lock && st.lock.release(); } catch (e) {}
      ['#ov', '#alert', '#gate'].forEach(s => { $(s).hidden = true; $(s).innerHTML = ''; }); st.open = null; st.alertNow = null; st.alerts = [];
    },
    render,
  };
})();

// the week: seven columns, a block for each activity in its category's colour (edit = the parent's week, blocks open the editor)
function weekHtml(data, mon, edit) {
  const t = today();
  let h = `<div class="legend">${Object.entries(CATS).map(([, c]) => `<span style="--c:${c.c}"><i></i>${T(c.n)}</span>`).join('')}</div><div class="week">`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), acts = dayActs(data, d);
    h += `<div class="wk-day${d === t ? ' today' : ''}${d < t ? ' gone' : ''}"><div class="wk-h"><b>${esc(dayName(d, 'short'))}</b> ${esc(dateShort(d))}</div>`
      + acts.map(a => `<${edit ? `button data-edit="${a.id}" data-day="${d}"` : 'div'} class="wk-it${(logOf(data, d, a.id)).done ? ' isdone' : ''}" style="--c:${catOf(a).c}"><span class="wk-t">${a.start}</span>${pic(a, 'xs')}<span class="wk-n">${esc(a.title)}</span></${edit ? 'button' : 'div'}>`).join('')
      + (acts.length ? '' : '<div class="wk-none">–</div>') + '</div>';
  }
  return h + '</div>';
}
