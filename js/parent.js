/* Dagsplan — the parent's screen: the plan (day and week), the activity editor (repeat, picture, note, voice, video,
   checklist, reminder), checklists, what the child has ticked and confirmed, and the settings. */
'use strict';
const Parent = (() => {
  const st = { tab: 'plan', day: today(), view: 'day', ed: null, led: null, logDay: today(), kid: null };
  // the child shown (the plan, the log, the message and first–then are each child's own); the device's child at first
  const kids = () => kidsOf(Store.data.settings);
  const K = () => kids().some(k => k.id === st.kid) ? st.kid : (st.kid = App.kid);
  const D = () => kidView(Store.data, K());
  const S = () => Store.data.settings || {};
  const KS = () => D().settings;
  const kidName = k => App.nameOf(k || K());
  const REM = { sound: ['🔔', 'Sound'], voice: ['🎤', 'Voice message'], silent: ['🔕', 'Silent (screen only)'], none: ['', 'No reminder'] };
  const REP = { none: 'Once', daily: 'Every day', weekly: 'Every week' };
  // Monday first; the digit is JavaScript's weekday (0 = Sunday)
  const WD = [1, 2, 3, 4, 5, 6, 0];
  const wdName = n => new Date(2024, 0, 7 + n).toLocaleDateString(LOCALE(), { weekday: 'short' });

  function top() {
    const s = S(), live = Store.cloud ? (Store.status === 'live' ? ['ok', T('Live')] : Store.status === 'denied' ? ['bad', T('No access')] : ['wait', T('Offline')]) : ['loc', T('Local mode')];
    return `<header class="p-top"><div class="p-brand">🗓️ <b>Dagsplan</b>${kids().length === 1 && s.child ? ` <span>· ${esc(s.child)}</span>` : ''}</div>`
      + `<span class="dotst ${live[0]}">${live[1]}</span><select id="p-lang" aria-label="Language">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === LANG ? ' selected' : ''}>${v}</option>`).join('')}</select></header>`
      + `<nav class="p-tabs">${[['plan', '📅', T('Plan')], ['lists', '☑️', T('Lists')], ['log', '👀', T('Log')], ['settings', '⚙️', T('Settings')]].map(([k, i, t]) => `<button data-ptab="${k}" class="${st.tab === k ? 'on' : ''}">${i} ${esc(t)}</button>`).join('')}</nav>`
      // whose plan is shown (with several children), that child's screen here, and the calls
      + `<div class="kidbar">${kids().length > 1 && st.tab !== 'lists' ? kids().map(k => `<button data-kid="${esc(k.id)}" class="${K() === k.id ? 'on' : ''}">👧 ${esc(k.name || T('the child'))}</button>`).join('') : ''}`
      + `<span class="kb-acts"><button class="p-child" data-childscreen="1" title="${T('Child’s screen')}">📺 ${esc(T('{0}’s screen', kidName()))}</button>`
      + `<button class="p-call" data-call="video" title="${T('Video call')}" aria-label="${T('Video call')}">📹</button><button class="p-call" data-call="audio" title="${T('Voice call')}" aria-label="${T('Voice call')}">📞</button></span></div>`;
  }
  function dayNav(key, d) {
    return `<div class="daynav"><button data-nav="${key}" data-n="${st.view === 'week' && key === 'day' ? -7 : -1}" aria-label="${T('Back')}">‹</button><b>${esc(st.view === 'week' && key === 'day' ? T('Week of {0}', dateShort(mondayOf(d))) : dateLong(d))}</b>`
      + `<button data-nav="${key}" data-n="${st.view === 'week' && key === 'day' ? 7 : 1}" aria-label="${T('Next')}">›</button>${d !== today() ? `<button class="chip" data-nav="${key}" data-n="0">${T('Today')}</button>` : ''}</div>`;
  }
  function statusTxt(a, d) {
    const L = logOf(D(), d, a.id), it = itemsOf(listOf(D(), a.list)), tk = L.ticks || {}, out = [];
    if (L.done) out.push(`<span class="ok">✓ ${T('Done at {0}', clockOf(L.done))}</span>`);
    if (L.seen) out.push(`<span class="seen">👁 ${T('Reminder confirmed {0}', clockOf(L.seen))}</span>`);
    if (it.length) out.push(`<span>☑ ${it.filter(i => tk[i.id]).length}/${it.length}</span>`);
    if (!L.done && d <= today() && (d < today() || (a.end ? mins(a.end) : mins(a.start) + 1) <= nowMin())) out.push(`<span class="no">${T('Not done')}</span>`);
    return out.join(' ');
  }
  function planHtml() {
    const d = st.day;
    let h = `<div class="seg"><button data-view="day" class="${st.view === 'day' ? 'on' : ''}">${T('Day')}</button><button data-view="week" class="${st.view === 'week' ? 'on' : ''}">${T('Week')}</button></div>` + dayNav('day', d);
    if (st.view === 'week') h += weekHtml(D(), mondayOf(d), true);
    else {
      const acts = dayActs(D(), d);
      h += acts.length ? '<div class="plist">' + acts.map(a => `<button class="prow" data-edit="${a.id}" data-day="${d}" style="--c:${catOf(a).c}"><span class="pt">${a.start}${a.end ? '–' + a.end : ''}</span>${pic(a, 'sm')}<span class="pn"><b>${esc(tx(a.title))}</b>`
        + `<small>${a.repeat && a.repeat !== 'none' ? '🔁 ' : ''}${REM[a.remind] ? REM[a.remind][0] : ''}${a.before ? ' −' + a.before + 'm' : ''}${a.audio ? ' 🎤' : ''}${a.note ? ' 📝' : ''}${a.video ? ' 🎬' : ''}${a.list ? ' ☑' : ''} ${statusTxt(a, d)}</small></span></button>`).join('') + '</div>'
        : `<div class="empty">${T('Nothing planned this day')}</div>`;
    }
    return h + `<button class="btn-add" data-new="act">＋ ${T('New activity')}</button>`;
  }
  function listsHtml() {
    const ls = Object.entries(D().lists || {});
    return (ls.length ? '<div class="plist">' + ls.map(([id, l]) => `<button class="prow" data-ledit="${id}">${pic(l, 'sm')}<span class="pn"><b>${esc(tx(l.title))}</b><small>${itemsOf(l).map(i => esc(i.emoji || '•')).join(' ')}</small></span></button>`).join('') + '</div>'
      : `<div class="empty">${T('No checklists yet')}</div>`) + `<button class="btn-add" data-new="list">＋ ${T('New checklist')}</button>`;
  }
  function logHtml() {
    const d = st.logDay, acts = dayActs(D(), d), goal = +KS().goal || 0, stars = weekStars(D(), d), L = (D().log || {})[d] || {};
    let h = dayNav('log', d) + `<div class="card stars"><b>⭐ ${T('{0} stars this week', stars)}</b>${goal ? ` <span>${T('goal {0}', goal)}</span><div class="bar"><i style="width:${Math.min(100, stars / goal * 100)}%"></i></div>` : ''}</div>`;
    h += acts.length ? acts.map(a => {
      const it = itemsOf(listOf(D(), a.list)), tk = logOf(D(), d, a.id).ticks || {};
      return `<div class="card lrow" style="--c:${catOf(a).c}"><div class="lr-h">${pic(a, 'sm')}<b>${a.start} ${esc(tx(a.title))}</b></div><div class="lr-s">${statusTxt(a, d) || T('Waiting')}</div>`
        + (it.length ? '<div class="lr-items">' + it.map(i => `<span class="${tk[i.id] ? 'ok' : 'no'}">${tk[i.id] ? '✓' : '○'} ${esc(i.emoji || '')} ${esc(tx(i.text))}${tk[i.id] ? ' <small>' + clockOf(tk[i.id]) + '</small>' : ''}</span>`).join('') + '</div>' : '') + '</div>';
    }).join('') : `<div class="empty">${T('Nothing planned this day')}</div>`;
    // checklists the child opened from the Lists tab on their own
    for (const [k, e] of Object.entries(L)) {
      if (!k.startsWith('l_')) continue; const l = listOf(D(), k.slice(2)); if (!l) continue;
      const it = itemsOf(l), tk = e.ticks || {};
      h += `<div class="card lrow"><div class="lr-h">${pic(l, 'sm')}<b>${esc(tx(l.title))}</b></div><div class="lr-s">${e.done ? `<span class="ok">✓ ${T('Done at {0}', clockOf(e.done))}</span>` : `☑ ${it.filter(i => tk[i.id]).length}/${it.length}`}</div></div>`;
    }
    const m = KS().msg;
    if (m && m.ts && ymd(new Date(m.ts)) === d) h += `<div class="card">💬 ${esc(m.emoji || '')} ${esc(m.text)} · ${m.from ? esc(m.from) + ' · ' : ''}${T('sent {0}', clockOf(m.ts))} · ${m.seen ? `<span class="ok">${T('seen {0}', clockOf(m.seen))}</span>` : `<span class="no">${T('not seen yet')}</span>`}</div>`;
    return h;
  }
  // all the PINs (the parents' and every child's) with the new ones in up ({pin, pin2} or {'cpin:<kid>': hash}) are different
  function pinsApart(up) {
    const s = S(), cur = { pin: s.pin, pin2: s.pin2 };
    for (const k of kids()) cur['cpin:' + k.id] = kidView(Store.data, k.id).settings.cpin;
    for (const [k, v] of Object.entries(up)) if (v && (k === 'pin' || k === 'pin2' || k.startsWith('cpin:'))) cur[k] = v;
    const all = Object.values(cur).filter(Boolean);
    return new Set(all).size === all.length;
  }
  function childLink() { return location.href.split('#')[0] + '#child?k=' + Store.code; }
  function settingsHtml() {
    const s = S(), ks = KS(), f = ks.ft || { first: {}, then: {} }, many = kids().length > 1;
    // the family's names where they were given
    const me = App.who(), mom = esc(s.mom || T('the mother')), dad = esc(s.dad || T('the father')), kid = esc(kidName());
    return `<div class="card"><h3>💬 ${T('Send a message to the screen now')}${many ? ' · ' + kid : ''}</h3><p class="muted">${T('It shows full screen on the child’s screen with a sound, until they press Done.')}</p>`
      + `<div class="row"><button class="emo-btn" data-pick="msg-e">${esc(st.msgE || '💬')}</button><input id="msg-t" maxlength="80" placeholder="${T('e.g. Time to come home for dinner')}"><button class="btn" id="msg-send">${T('Send')}</button></div></div>`
      + `<div class="card"><h3>➜ ${T('First – then')}${many ? ' · ' + kid : ''}</h3><p class="muted">${T('Two big cards on the child’s screen: first this, then that.')}</p>`
      + `<div class="row"><b class="lbl">${T('First')}</b><button class="emo-btn" data-pick="ft1">${esc(st.ft1 || f.first.emoji || '📚')}</button><input id="ft1-t" maxlength="40" value="${esc(f.first.text || '')}" placeholder="${T('e.g. Homework')}"></div>`
      + `<div class="row"><b class="lbl">${T('Then')}</b><button class="emo-btn" data-pick="ft2">${esc(st.ft2 || f.then.emoji || '🎮')}</button><input id="ft2-t" maxlength="40" value="${esc(f.then.text || '')}" placeholder="${T('e.g. 30 min gaming')}"></div>`
      + `<div class="row"><button class="btn" id="ft-save">${T('Show on the screen')}</button>${ks.ft ? `<button class="btn ghost" id="ft-clear">${T('Remove')}</button>${ks.ft.firstDone ? `<span class="ok">✓ ${T('First part done {0}', clockOf(ks.ft.firstDone))}</span>` : ''}` : ''}</div></div>`
      // the child shown: name, star goal, PIN; adding a further child, removing one
      + `<div class="card"><h3>👧 ${kid}</h3><label>${T('The child’s name')}<input id="s-name" maxlength="30" value="${esc(ks.child || '')}"></label>`
      + `<label>${T('Star goal per week')}<input id="s-goal" type="number" min="0" max="200" value="${esc(ks.goal || 0)}"></label>`
      + `<label>${T('New PIN for {0} (4 digits; opens the child’s screen)', kid)}<input id="s-cpin" inputmode="numeric" maxlength="8" placeholder="••••"></label>`
      + `<p class="muted small">${ks.cpin ? '🔒 ' + T('The child’s screen asks for the PIN for {0}.', kid) : T('No PIN for {0}: the child’s screen opens without one.', kid)}</p>`
      + `<div class="row"><button class="btn" id="s-kid-save">${T('Save')}</button>${ks.cpin ? `<button class="btn ghost" id="s-cpin-off">${T('Remove the PIN for {0}', kid)}</button>` : ''}${K() !== 'child' ? `<button class="btn ghost danger" id="s-kid-del">${T('Remove {0}', kid)}</button>` : ''}</div>`
      + `<div class="row"><input id="s-newkid" maxlength="30" placeholder="${T('The new child’s name')}"><button class="btn ghost" id="s-kid-add">＋ ${T('Add a child')}</button></div></div>`
      + `<div class="card"><h3>👨‍👩‍👧 ${T('Family')}</h3>`
      + `<label>${T('Mother’s name')}<input id="s-mom" maxlength="30" value="${esc(s.mom || '')}"></label>`
      + `<label>${T('Father’s name')}<input id="s-dad" maxlength="30" value="${esc(s.dad || '')}"></label>`
      // each parent changes only their own PIN (and sets the other's only while it is not set yet)
      + (me === 'mom' || !s.pin ? `<label>${T('New PIN for {0} (4 digits)', mom)}<input id="s-pin" inputmode="numeric" maxlength="8" placeholder="••••"></label>` : `<p class="muted small">🔒 ${T('Only {0} can change their own PIN.', mom)}</p>`)
      + (me === 'dad' || !s.pin2 ? `<label>${T('New PIN for {0} (4 digits)', dad)}<input id="s-pin2" inputmode="numeric" maxlength="8" placeholder="••••"></label>` : `<p class="muted small">🔒 ${T('Only {0} can change their own PIN.', dad)}</p>`)
      + `<p class="muted small">${s.pin2 ? '👩 👨 ' + T('{0} and {1} each have their own PIN.', mom, dad) : T('No PIN for {0} yet: only the PIN for {1} opens the parent screen.', dad, mom)}</p>`
      + `<div class="row"><button class="btn" id="s-save">${T('Save')}</button></div></div>`
      + `<div class="card"><h3>🔑 ${T('Family password')}</h3><p class="muted">${s.gate ? T('A new device opens Dagsplan with the family password only.') : T('No family password yet: set one, so a new device can open Dagsplan with it.')}</p>`
      + `<label>${T('New family password (at least 6 letters)')}<input id="s-gpw" type="password" autocomplete="new-password" autocapitalize="off"></label><button class="btn" id="s-gpw-save">${T('Save')}</button></div>`
      // the relay address stays in the family's data, so it is never in the public code
      + `<div class="card"><h3>📡 ${T('Calls between different networks')}</h3><p class="muted">${s.turn ? '✓ ' + T('The relay server is set: calls work between mobile data and Wi-Fi.') : T('Paste the relay server’s address (Metered → Show API Key), so calls work between mobile data and Wi-Fi.')}</p>`
      + `<label>${T('Relay server address')}<input id="s-turn" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://….metered.live/api/v1/turn/credentials?apiKey=…"></label>`
      + `<div class="row"><button class="btn" id="s-turn-save">${T('Save')}</button>${s.turn ? `<button class="btn ghost" id="s-turn-off">${T('Remove')}</button>` : ''}</div></div>`
      + `<div class="card"><h3>📱 ${T('The child’s screen')}</h3><p class="muted">${T('Open this link on the child’s tablet, phone or PC, then “Add to Home screen”.')} ${T('Another parent opens the same link and presses 🔒 Parent.')}</p>`
      + `<input readonly value="${esc(childLink())}" id="s-link"><div class="row"><button class="btn" id="s-copy">${T('Copy')}</button>${navigator.share ? `<button class="btn ghost" id="s-share">${T('Share')}</button>` : ''}<a class="btn ghost" href="#child">${T('Open the child’s screen here')}</a></div>`
      + (Store.cloud ? '' : `<p class="warn">${T('Local mode: the plan is kept in this browser only. Add the Firebase settings to sync between devices (see README).')}</p>`) + '</div>'
      + `<div class="card"><h3>💻 ${T('This device')}</h3><label>${T('When Dagsplan opens on this device, show')}<select id="s-home">`
      + `<option value="parent"${App.home === 'parent' ? ' selected' : ''}>👨‍👩‍👧 ${T('the parent screen (asks the PIN)')}</option><option value="child"${App.home === 'child' ? ' selected' : ''}>👧 ${T('the child’s screen')}</option></select></label>`
      + (many ? `<label>${T('The child’s screen on this device is for')}<select id="s-devkid">${kids().map(k => `<option value="${esc(k.id)}"${App.kid === k.id ? ' selected' : ''}>👧 ${esc(k.name || T('the child'))}</option>`).join('')}</select></label>` : '') + '</div>'
      + `<div class="card"><h3>🔔 ${T('About reminders')}</h3><p class="muted">${T('Reminders are sure when the child’s screen is open (a tablet on the wall with the screen kept on is best). With the app in the background a notification is shown, sometimes a little late. When the app is closed, a web app cannot ring: that needs the Android app version later.')}</p></div>`
      + `<div class="card"><button class="btn ghost" id="s-leave">${T('Leave this family on this device')}</button></div>`;
  }
  function render() {
    const app = $('#app');
    app.className = 'parent';
    const body = st.tab === 'plan' ? planHtml() : st.tab === 'lists' ? listsHtml() : st.tab === 'log' ? logHtml() : settingsHtml();
    // keep what is being typed in Settings when the data changes underneath
    const keep = st.tab === 'settings' ? $$('#app input').reduce((o, i) => (i.id && (o[i.id] = i.value), o), {}) : null;
    app.innerHTML = top() + `<main class="p-main">${body}</main>`;
    if (keep) for (const [id, v] of Object.entries(keep)) { const i = document.getElementById(id); if (i && document.activeElement !== i) i.value = v; }
  }

  /* ---- the activity editor ---- */
  function edAct(id, day) {
    const a = id ? { ...(D().acts || {})[id] } : { kid: kids().length > 1 ? K() : '', title: '', emoji: '⭐', cat: 'home', date: st.day, start: '', end: '', repeat: 'none', days: String(weekday(st.day)), remind: 'sound', before: 0, stars: 1 };
    st.ed = { id, day: day || st.day, a };
    renderEd();
  }
  function renderEd() {
    const { a, id } = st.ed, lists = Object.entries(D().lists || {});
    $('#ov').innerHTML = `<div class="ed"><div class="ed-h"><h2>${id ? T('Edit activity') : T('New activity')}</h2><button class="x" data-ed="close" aria-label="${T('Close')}">✕</button></div>`
      // with several children: for every child, or only one
      + (kids().length > 1 ? `<div class="lbl">${T('For whom?')}</div><div class="seg wrap"><button data-forkid="" class="${!a.kid ? 'on' : ''}">👨‍👩‍👧 ${T('Every child')}</button>${kids().map(k => `<button data-forkid="${esc(k.id)}" class="${a.kid === k.id ? 'on' : ''}">👧 ${esc(k.name || T('the child'))}</button>`).join('')}</div>` : '')
      + `<label>${T('What?')}<input id="e-title" maxlength="50" value="${esc(a.title)}" placeholder="${T('e.g. Swimming')}"></label>`
      + `<div class="lbl">${T('Picture')}</div><div class="row">${pic(a, 'lg')}<button class="btn ghost" data-pick="act">😀 ${T('Choose emoji')}</button><label class="btn ghost file">📷 ${T('Photo')}<input type="file" accept="image/*" id="e-img" hidden></label>${a.img ? `<button class="btn ghost" data-ed="noimg">${T('Remove photo')}</button>` : ''}</div>`
      + `<div class="lbl">${T('Category')}</div><div class="cats">${Object.entries(CATS).map(([k, c]) => `<button data-cat="${k}" class="${a.cat === k ? 'on' : ''}" style="--c:${c.c}">${c.e} ${T(c.n)}</button>`).join('')}</div>`
      + `<div class="row3"><label>${T('Date')}<input type="date" id="e-date" value="${esc(a.date)}"></label><label>${T('From')}<input type="time" id="e-start" value="${esc(a.start)}"></label><label>${T('To')}<input type="time" id="e-end" value="${esc(a.end || '')}"></label></div>`
      + `<div class="lbl">${T('Repeat')}</div><div class="seg">${Object.entries(REP).map(([k, t]) => `<button data-rep="${k}" class="${(a.repeat || 'none') === k ? 'on' : ''}">${T(t)}</button>`).join('')}</div>`
      + (a.repeat === 'weekly' ? `<div class="wds">${WD.map(n => `<button data-wd="${n}" class="${String(a.days || '').includes(n) ? 'on' : ''}">${esc(wdName(n))}</button>`).join('')}</div>` : '')
      + (a.repeat && a.repeat !== 'none' ? `<label>${T('Until (optional)')}<input type="date" id="e-until" value="${esc(a.until || '')}"></label>` : '')
      + `<div class="lbl">${T('Reminder')}</div><div class="seg wrap">${Object.entries(REM).map(([k, [i, t]]) => `<button data-rem="${k}" class="${a.remind === k ? 'on' : ''}">${i} ${T(t)}</button>`).join('')}</div>`
      + (a.remind !== 'none' ? `<label>${T('When')}<select id="e-before">${[0, 5, 10, 15, 30, 60].map(m => `<option value="${m}"${+a.before === m ? ' selected' : ''}>${m ? T('{0} min before', m) : T('At the start')}</option>`).join('')}</select></label>` : '')
      + `<div class="lbl">${T('Voice message')} <small class="muted">${T('(up to 30 s; played with the reminder and in the activity)')}</small></div><div class="row">`
      + (Rec.rec ? `<button class="btn rec" data-ed="stop">⏹ ${T('Stop')}</button><span class="recdot">● ${T('Recording…')}</span>` : `<button class="btn ghost" data-ed="rec">🎤 ${a.audio ? T('Record again') : T('Record')}</button>`)
      + (a.audio && !Rec.rec ? `<button class="btn ghost" data-ed="play">▶ ${T('Play')}</button><button class="btn ghost" data-ed="noaudio">${T('Delete')}</button>` : '') + '</div>'
      + `<label>${T('Note')}<textarea id="e-note" rows="2" maxlength="300" placeholder="${T('e.g. Remember your towel')}">${esc(a.note || '')}</textarea></label>`
      + `<label>${T('Video link (optional)')}<input id="e-video" type="url" value="${esc(a.video || '')}" placeholder="https://youtube.com/…"></label>`
      + `<label>${T('Checklist')}<select id="e-list"><option value="">${T('None')}</option>${lists.map(([k, l]) => `<option value="${k}"${a.list === k ? ' selected' : ''}>${esc(l.emoji || '')} ${esc(l.title)}</option>`).join('')}</select></label>`
      + `<label>${T('Stars when done')}<select id="e-stars">${[0, 1, 2, 3].map(n => `<option value="${n}"${(a.stars == null ? 1 : +a.stars) === n ? ' selected' : ''}>${n ? '⭐'.repeat(n) : T('None')}</option>`).join('')}</select></label>`
      + `<div class="ed-f"><button class="btn" data-ed="save">${T('Save')}</button>`
      + (id ? (a.repeat && a.repeat !== 'none' ? `<button class="btn ghost danger" data-ed="skip">${T('Delete this day only')}</button><button class="btn ghost danger" data-ed="del">${T('Delete every day')}</button>` : `<button class="btn ghost danger" data-ed="del">${T('Delete')}</button>`) : '')
      + '</div></div>';
    $('#ov').hidden = false;
  }
  // read the typed fields back into the activity before redrawing the editor
  function grab() {
    const a = st.ed.a, v = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
    for (const [k, id] of [['title', 'e-title'], ['date', 'e-date'], ['start', 'e-start'], ['end', 'e-end'], ['until', 'e-until'], ['note', 'e-note'], ['video', 'e-video'], ['list', 'e-list']]) { const x = v(id); if (x !== undefined) a[k] = x.trim(); }
    if (v('e-before') !== undefined) a.before = +v('e-before');
    if (v('e-stars') !== undefined) a.stars = +v('e-stars');
  }
  function saveAct() {
    grab(); const a = st.ed.a;
    if (!a.title) { toast(T('Write what the activity is')); $('#e-title').focus(); return; }
    if (!a.start) { toast(T('Choose a start time')); $('#e-start').focus(); return; }
    if (!a.date) a.date = st.day;
    if (a.end && mins(a.end) <= mins(a.start)) a.end = '';
    if (a.repeat === 'weekly' && !a.days) a.days = String(weekday(a.date));
    if (a.repeat !== 'weekly') delete a.days;
    if (!a.repeat || a.repeat === 'none') delete a.until;
    for (const k of Object.keys(a)) if (a[k] === '' || a[k] == null) delete a[k];
    Store.set('acts/' + (st.ed.id || rid()), a);
    closeEd(); toast(T('Saved'));
  }
  function closeEd() { Rec.stop(); const was = st.ed || st.led; st.ed = null; st.led = null; $('#ov').hidden = true; $('#ov').innerHTML = ''; if (was) render(); }

  /* ---- the checklist editor ---- */
  function edList(id) {
    const l = id ? JSON.parse(JSON.stringify((D().lists || {})[id])) : { title: '', emoji: '🎒', items: [] };
    l.items = itemsOf(l); st.led = { id, l }; renderLed();
  }
  function renderLed() {
    const { l, id } = st.led;
    $('#ov').innerHTML = `<div class="ed"><div class="ed-h"><h2>${id ? T('Edit checklist') : T('New checklist')}</h2><button class="x" data-ed="close" aria-label="${T('Close')}">✕</button></div>`
      + `<div class="row"><button class="emo-btn" data-pick="list">${esc(l.emoji || '🎒')}</button><input id="l-title" maxlength="40" value="${esc(l.title)}" placeholder="${T('e.g. School bag')}"></div>`
      + `<div class="lbl">${T('Steps')}</div>` + l.items.map((i, n) => `<div class="li-row">${i.img ? `<img class="pic sm" src="${esc(i.img)}" alt="">` : ''}<button class="emo-btn sm" data-pick="it:${n}">${esc(i.emoji || '•')}</button>`
        + `<input data-it="${n}" maxlength="40" value="${esc(i.text)}"><label class="mini file" title="${T('Photo')}">📷<input type="file" accept="image/*" data-itimg="${n}" hidden></label>`
        + `<button class="mini" data-mv="${n}" data-d="-1" aria-label="↑">↑</button><button class="mini" data-mv="${n}" data-d="1" aria-label="↓">↓</button><button class="mini danger" data-rm="${n}" aria-label="${T('Delete')}">✕</button></div>`).join('')
      + `<button class="btn ghost" data-ed="additem">＋ ${T('Add a step')}</button>`
      + `<div class="ed-f"><button class="btn" data-ed="lsave">${T('Save')}</button>${id ? `<button class="btn ghost danger" data-ed="ldel">${T('Delete')}</button>` : ''}</div></div>`;
    $('#ov').hidden = false;
  }
  function grabL() { const l = st.led.l, t = $('#l-title'); if (t) l.title = t.value.trim(); $$('[data-it]').forEach(i => { l.items[+i.dataset.it].text = i.value.trim(); }); }
  function saveList() {
    grabL(); const l = st.led.l;
    if (!l.title) { toast(T('Give the list a name')); return; }
    l.items = l.items.filter(i => i.text || i.img).map(i => { const o = { id: i.id || rid(6), text: i.text || '' }; if (i.emoji) o.emoji = i.emoji; if (i.img) o.img = i.img; return o; });
    Store.set('lists/' + (st.led.id || rid()), l); closeEd(); toast(T('Saved'));
  }

  // a grid of emoji to choose from (cb gets the chosen one)
  function pickEmoji(cb) {
    const p = document.createElement('div'); p.className = 'picker';
    p.innerHTML = `<div class="pk-in">${EMOJIS.map(e => `<button>${e}</button>`).join('')}</div>`;
    p.addEventListener('click', e => { const b = e.target.closest('button'); if (b) cb(b.textContent); if (b || e.target === p) p.remove(); });
    document.body.appendChild(p);
  }
  function onPick(what) {
    if (what === 'act') { grab(); pickEmoji(e => { st.ed.a.emoji = e; delete st.ed.a.img; renderEd(); }); }
    else if (what === 'list') { grabL(); pickEmoji(e => { st.led.l.emoji = e; renderLed(); }); }
    else if (what.startsWith('it:')) { grabL(); pickEmoji(e => { st.led.l.items[+what.slice(3)].emoji = e; renderLed(); }); }
    else pickEmoji(e => { st[what.replace('-e', 'E')] = e; render(); });
  }

  async function onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const ds = b.dataset;
    if (ds.ptab) { st.tab = ds.ptab; render(); return; }
    if (ds.kid) { st.kid = ds.kid; render(); return; }
    if (ds.forkid !== undefined) { grab(); st.ed.a.kid = ds.forkid; renderEd(); return; }
    // the child's screen here shows the child chosen above
    if (ds.childscreen) { App.kid = K(); location.hash = '#child'; return; }
    if (ds.view) { st.view = ds.view; render(); return; }
    if (ds.nav) { const k = ds.nav === 'day' ? 'day' : 'logDay'; st[k] = +ds.n ? addDays(st[k], +ds.n) : today(); render(); return; }
    if (ds.new === 'act') { edAct(null); return; }
    if (ds.new === 'list') { edList(null); return; }
    if (ds.edit) { edAct(ds.edit, ds.day); return; }
    if (ds.ledit) { edList(ds.ledit); return; }
    if (ds.pick) { onPick(ds.pick); return; }
    if (ds.cat) { grab(); st.ed.a.cat = ds.cat; renderEd(); return; }
    if (ds.rep) { grab(); st.ed.a.repeat = ds.rep; if (ds.rep === 'weekly' && !st.ed.a.days) st.ed.a.days = String(weekday(st.ed.a.date || st.day)); renderEd(); return; }
    if (ds.wd) { grab(); const a = st.ed.a, s = String(a.days || ''); a.days = s.includes(ds.wd) ? s.replace(ds.wd, '') : s + ds.wd; renderEd(); return; }
    if (ds.rem) { grab(); st.ed.a.remind = ds.rem; renderEd(); return; }
    if (ds.mv) { grabL(); const L = st.led.l.items, i = +ds.mv, j = i + +ds.d; if (j >= 0 && j < L.length) [L[i], L[j]] = [L[j], L[i]]; renderLed(); return; }
    if (ds.rm) { grabL(); st.led.l.items.splice(+ds.rm, 1); renderLed(); return; }
    switch (ds.ed) {
      case 'close': closeEd(); return;
      case 'save': saveAct(); return;
      case 'noimg': grab(); delete st.ed.a.img; renderEd(); return;
      case 'rec': grab(); try { await Rec.start(src => { if (st.ed) { st.ed.a.audio = src; renderEd(); } }); renderEd(); } catch (x) { toast(T('The microphone could not be used')); } return;
      case 'stop': grab(); Rec.stop(); return;
      case 'play': new Audio(st.ed.a.audio).play().catch(() => {}); return;
      case 'noaudio': grab(); delete st.ed.a.audio; renderEd(); return;
      case 'skip': if (confirm(T('Delete “{0}” on {1} only?', st.ed.a.title, dateLong(st.ed.day)))) { Store.set(`acts/${st.ed.id}/skip/${st.ed.day}`, true); closeEd(); } return;
      case 'del': if (confirm(T('Delete “{0}”?', st.ed.a.title))) { Store.remove('acts/' + st.ed.id); closeEd(); } return;
      case 'additem': grabL(); st.led.l.items.push({ text: '', emoji: '' }); renderLed(); setTimeout(() => { const L = $$('[data-it]'); L.length && L[L.length - 1].focus(); }); return;
      case 'lsave': saveList(); return;
      case 'ldel': if (confirm(T('Delete “{0}”?', st.led.l.title))) { Store.remove('lists/' + st.led.id); closeEd(); } return;
    }
    switch (b.id) {
      case 'msg-send': { const t = $('#msg-t').value.trim(); if (!t) { toast(T('Write the message')); return; } Store.set(kidBase(K()) + '/msg', { id: rid(6), text: t, emoji: st.msgE || '💬', ts: Date.now(), from: App.whoName() }); $('#msg-t').value = ''; toast(T('Sent')); return; }
      case 'ft-save': { const a = $('#ft1-t').value.trim(), c = $('#ft2-t').value.trim(), f = KS().ft || { first: {}, then: {} }; if (!a || !c) { toast(T('Write both parts')); return; } Store.set(kidBase(K()) + '/ft', { first: { emoji: st.ft1 || f.first.emoji || '📚', text: a }, then: { emoji: st.ft2 || f.then.emoji || '🎮', text: c } }); st.ft1 = st.ft2 = null; toast(T('Saved')); return; }
      case 'ft-clear': Store.remove(kidBase(K()) + '/ft'); return;
      case 's-save': {
        const val = id => ($(id) ? $(id).value.trim() : '');
        const pin = val('#s-pin'), pin2 = val('#s-pin2'), up = { mom: $('#s-mom').value.trim(), dad: $('#s-dad').value.trim() };
        const bad = App.pinsBad(pin, pin2); if (bad) { toast(bad); return; }
        if (pin) up.pin = await pinHash(Store.code, pin);
        if (pin2) up.pin2 = await pinHash(Store.code, pin2);
        if (!pinsApart(up)) { toast(T('The PINs must all be different')); return; }
        Store.update('settings', up); for (const i of ['#s-pin', '#s-pin2']) if ($(i)) $(i).value = ''; toast(T('Saved')); return;
      }
      case 's-kid-save': {
        const cpin = $('#s-cpin').value.trim(), up = { goal: Math.max(0, +$('#s-goal').value || 0) };
        up[K() === 'child' ? 'child' : 'name'] = $('#s-name').value.trim();
        const bad = App.pinsBad(cpin); if (bad) { toast(bad); return; }
        if (cpin) up.cpin = await pinHash(Store.code, cpin);
        if (!pinsApart({ ['cpin:' + K()]: up.cpin })) { toast(T('The PINs must all be different')); return; }
        Store.update(kidBase(K()), up); $('#s-cpin').value = ''; toast(T('Saved')); return;
      }
      case 's-cpin-off': Store.remove(kidBase(K()) + '/cpin'); toast(T('Saved')); return;
      case 's-kid-add': {
        const name = $('#s-newkid').value.trim(); if (!name) { toast(T('Write the child’s name')); return; }
        const id = 'k' + rid(6); Store.set('settings/kids/' + id, { name, goal: 20 }); st.kid = id; $('#s-newkid').value = ''; toast(T('Saved')); render(); return;
      }
      case 's-kid-del': {
        // a further child goes with their own activities and ticks; the first child stays
        const k = K(); if (k === 'child' || !confirm(T('Remove {0}? Their own activities and ticks are deleted too.', kidName(k)))) return;
        for (const [id, a] of Object.entries(Store.data.acts || {})) if (a && a.kid === k) Store.remove('acts/' + id);
        Store.remove('klog/' + k); Store.remove('settings/kids/' + k); st.kid = 'child'; if (App.kid === k) App.kid = 'child'; render(); return;
      }
      case 's-turn-save': {
        // checks the address gives relay servers before keeping it
        const u = $('#s-turn').value.trim();
        if (!/^https:\/\/[\w.-]+\/\S+$/.test(u)) { toast(T('That is not a relay server address')); return; }
        let ok = false; try { const r = await fetch(u); ok = r.ok && Array.isArray(await r.json()); } catch (x) {}
        if (!ok) { toast(T('That is not a relay server address')); return; }
        Store.update('settings', { turn: u }); $('#s-turn').value = ''; toast(T('Saved')); return;
      }
      case 's-turn-off': Store.remove('settings/turn'); toast(T('Saved')); return;
      case 's-gpw-save': {
        // the new password's key points at this family; the old key is removed so the old password stops working
        const pw = $('#s-gpw').value; if (pw.trim().length < 6) { toast(T('The family password must have at least 6 letters')); return; }
        const gh = await gateHash(pw), old = S().gate;
        if (gh === old) { $('#s-gpw').value = ''; toast(T('Saved')); return; }
        try {
          const taken = await Store.gate(gh);
          if ((taken && taken !== Store.code) || (!taken && !(await Store.setGate(gh, Store.code)))) { toast(T('This family password is taken — choose another')); return; }
          if (old) await Store.setGate(old, null);
        } catch (x) { toast(T('No connection — try again')); return; }
        Store.update('settings', { gate: gh }); $('#s-gpw').value = ''; toast(T('Saved')); return;
      }
      case 's-copy': { const i = $('#s-link'); i.select(); try { await navigator.clipboard.writeText(i.value); } catch (x) { document.execCommand('copy'); } toast(T('Copied')); return; }
      case 's-share': navigator.share({ title: 'Dagsplan', url: childLink() }).catch(() => {}); return;
      case 's-leave': if (confirm(T('Leave this family on this device? The plan itself is not deleted.'))) App.leave(); return;
    }
  }
  async function onChange(e) {
    const t = e.target;
    if (t.id === 'p-lang') { setLang(t.value); render(); return; }
    if (t.id === 's-home') { App.home = t.value; toast(T('Saved')); return; }
    if (t.id === 's-devkid') { App.kid = t.value; toast(T('Saved')); return; }
    if (t.id === 'e-img' && t.files[0]) { grab(); try { st.ed.a.img = await shrinkImage(t.files[0]); } catch (x) { toast(T('The picture could not be read')); } renderEd(); return; }
    if (t.dataset.itimg && t.files[0]) { grabL(); try { st.led.l.items[+t.dataset.itimg].img = await shrinkImage(t.files[0], 200); } catch (x) { toast(T('The picture could not be read')); } renderLed(); return; }
    if (t.id === 'e-date' && st.ed && st.ed.a.repeat === 'weekly' && !st.ed.id) { grab(); st.ed.a.days = String(weekday(t.value)); renderEd(); }
  }
  let off = null;
  return {
    start() {
      document.body.dataset.role = 'parent';
      off = Store.on(() => { if (!st.ed && !st.led) render(); });
      render();
      document.addEventListener('click', onClick); document.addEventListener('change', onChange);
      this.t = setInterval(() => { if (!st.ed && !st.led && st.tab !== 'settings') render(); }, 60000);
    },
    stop() { off && off(); clearInterval(this.t); closeEd(); document.removeEventListener('click', onClick); document.removeEventListener('change', onChange); },
    render,
  };
})();
