/* Dagsplan — calls in the family: voice or video, one person to another (the child and a parent, or the two parents) or
   the whole family together. The picture and sound go straight between each two people in the call (WebRTC, a small mesh).
   The call is set up through the family's place in the database (f/<code>/call):
     { id, from, invited {who: true}, video, ts, joined {who: {dev, at}}, declined {who: true}, pairs {'a~b': {offer, answer}} }
   Of each two people in the call the one who joined later sends the offer (pairs['later~earlier']), the other answers.
   Leaving removes one's own entries; the call is removed when nobody else is in it or still being rung. A call reaches only
   a device that has Dagsplan open (the child's screen, or the parent screen opened with that parent's PIN). Between
   different networks the picture and sound go through a relay server (TURN, set in the parents' Settings). */
'use strict';
const Call = (() => {
  const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const dev = rid(8);        // this device: which of a person's ringing devices answered
  const RING = 45000;        // how long a call rings
  let st = null;             // the call here: { id, pick, video, ringing, joined, at, local, peers {who: {pc, remote, connected, answered}}, muted }
  // who this device is in a call: its child on the child's screen ('child' or a further child's id), 'mom' or 'dad' on the parent screen
  const self = () => document.body.dataset.role === 'child' ? App.kid : document.body.dataset.role === 'parent' ? App.who() : '';
  const S = () => Store.data.settings || {};
  // the family members who can be called: the parents with a PIN, and the children
  const people = () => ['mom', 'dad'].filter(w => S()[w === 'mom' ? 'pin' : 'pin2']).concat(kidsOf(S()).map(k => k.id));
  const nameOf = w => App.nameOf(w);
  const icon = w => ({ mom: '👩', dad: '👨' })[w] || '👧';
  const pairKey = (a, b) => a + '~' + b;

  // the relay service's address: from the parents' Settings (kept in the family's data, not in the public code), else config.js
  const relayUrl = () => S().turn || TURN.url || '';
  const relayOn = () => !!(relayUrl() || (TURN.servers || []).length);
  // the relay servers: a fixed list, or fresh ones from the relay service's address (kept for an hour)
  let ice = null, iceAt = 0, iceFrom = '';
  async function iceServers() {
    if (ice && Date.now() - iceAt < 3600e3 && iceFrom === relayUrl()) return ice;
    let relay = TURN.servers || [];
    iceFrom = relayUrl();
    if (iceFrom) try { const r = await fetch(iceFrom); if (r.ok) relay = await r.json(); } catch (e) {}
    ice = STUN.concat(relay); iceAt = Date.now(); return ice;
  }
  // the offer and the answer are sent whole, once the network addresses are gathered (no trickling)
  const gathered = pc => new Promise(done => {
    if (pc.iceGatheringState === 'complete') return done();
    const t = setTimeout(done, 6000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); done(); } });
  });
  const media = video => navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user', width: { ideal: 640 } } : false });
  async function peer(who) {
    // taken at once, so a second database update meanwhile does not open a second connection to the same person
    const p = st.peers[who] = {};
    const servers = await iceServers();
    if (!st || st.peers[who] !== p) return p;
    const pc = p.pc = new RTCPeerConnection({ iceServers: servers });
    st.local.getTracks().forEach(t => pc.addTrack(t, st.local));
    pc.ontrack = e => { p.remote = e.streams[0]; draw(); };
    pc.onconnectionstatechange = () => {
      if (!st || st.peers[who] !== p) return;
      if (pc.connectionState === 'connected') { p.connected = true; draw(); }
      else if (pc.connectionState === 'failed') {
        toast(relayOn() ? T('The call with {0} could not connect', nameOf(who)) : T('The call could not connect: different networks need the relay server (see README)'));
        dropPeer(who); draw();
      }
    };
    return p;
  }
  function dropPeer(who) { const p = st && st.peers[who]; if (!p) return; try { p.pc && p.pc.close(); } catch (e) {} delete st.peers[who]; }

  /* ---- starting: pick whom to call (one person, or everyone), then ring them ---- */
  function start(video) {
    const i = self(); if (st || !i) return;
    if (!Store.cloud) { toast(T('Calls need the Firebase settings (see README)')); return; }
    Sound.unlock();
    st = { pick: true, video }; draw();
  }
  async function dial(video, to) {
    const i = self(); if (!i) return;
    st = null;
    let local; try { local = await media(video); } catch (e) { toast(T('No access to the camera or microphone')); draw(); return; }
    const id = rid(10), at = Date.now(), invited = {};
    for (const w of to) invited[w] = true;
    st = { id, video, local, joined: true, at, peers: {}, from: i };
    Store.set('call', { id, from: i, invited, video: !!video, ts: at, joined: { [i]: { dev, at } } });
    st.timer = setTimeout(() => { if (st && st.id === id && !Object.keys(st.peers).length) { toast(T('No answer')); leave(); } }, RING);
    draw();
  }
  async function answer() {
    const c = Store.data.call, i = self(); if (!st || !c || c.id !== st.id || st.joined) return;
    stopRing();
    let local; try { local = await media(c.video); } catch (e) { toast(T('No access to the camera or microphone')); decline(); return; }
    Object.assign(st, { local, joined: true, at: Date.now(), peers: {}, ringing: false });
    Store.set('call/joined/' + i, { dev, at: st.at });
    draw();
  }
  function decline() { const i = self(); if (st && st.id) Store.set('call/declined/' + i, true); close(); }
  // leave the call: one's own entries go; the call goes when nobody else is in it or still being rung
  function leave() {
    const c = Store.data.call, i = self();
    if (st && st.id && c && c.id === st.id) {
      const others = Object.keys(c.joined || {}).filter(w => w !== i);
      if (!others.length || (others.length === 1 && !ringingOthers(c, i).length)) Store.remove('call');
      else {
        Store.set('call/left/' + i, true);
        Store.remove('call/joined/' + i);
        for (const k of Object.keys(c.pairs || {})) if (k.split('~').includes(i)) Store.remove('call/pairs/' + k);
      }
    }
    close();
  }
  // the people invited who have not answered or declined and are still being rung
  const ringingOthers = (c, i) => Date.now() - (+c.ts || 0) > RING ? [] : Object.keys(c.invited || {}).filter(w => w !== i && !(c.joined || {})[w] && !(c.declined || {})[w] && !(c.left || {})[w]);
  function close() {
    if (!st) return;
    clearTimeout(st.timer); stopRing();
    for (const w of Object.keys(st.peers || {})) dropPeer(w);
    if (st.local) st.local.getTracks().forEach(t => t.stop());
    st = null; draw();
  }
  function ring() { stopRing(); Sound.chime(); st.ring = setInterval(() => { Sound.chime(); try { navigator.vibrate && navigator.vibrate(400); } catch (e) {} }, 2500); }
  function stopRing() { if (st && st.ring) { clearInterval(st.ring); st.ring = null; } }

  /* ---- following the call in the database ---- */
  async function onData(d) {
    const c = d.call, i = self();
    if (st && st.pick) return;
    if (st) {
      if (!c || c.id !== st.id) { if (st.joined && Object.keys(st.peers).length) toast(T('The call ended')); close(); return; }
      if (!st.joined) {   // still ringing here: answered on another of this person's devices, or rung too long
        const j = (c.joined || {})[i];
        if ((j && j.dev !== dev) || Date.now() - (+c.ts || 0) > RING + 15000) close();
        return;
      }
      await follow(c, i);
      return;
    }
    // a new call to this person rings here (not an old one left behind)
    if (!c || !i || !(c.invited || {})[i] || (c.joined || {})[i] || (c.declined || {})[i] || (c.left || {})[i] || Math.abs(Date.now() - (+c.ts || 0)) > RING) return;
    st = { id: c.id, from: c.from, video: !!c.video, ringing: true, peers: {} };
    draw(); ring();
  }
  // in the call: connect to each other person in it, and let go of those who left
  async function follow(c, i) {
    const joined = c.joined || {}, pairs = c.pairs || {};
    for (const w of Object.keys(st.peers)) if (!joined[w]) { dropPeer(w); draw(); }
    for (const [w, j] of Object.entries(joined)) {
      if (w === i || !st) continue;
      const mine = joined[i] || { at: st.at };
      const iOffer = (+mine.at || 0) > (+j.at || 0) || ((+mine.at || 0) === (+j.at || 0) && i > w);
      if (iOffer) {
        const k = pairKey(i, w), pr = pairs[k];
        if (!st.peers[w] && !pr) {
          const p = await peer(w); if (!st || !p.pc) return;
          await p.pc.setLocalDescription(await p.pc.createOffer()); await gathered(p.pc);
          if (!st || st.peers[w] !== p) return;
          Store.set('call/pairs/' + k, { offer: p.pc.localDescription.toJSON() });
        } else if (st.peers[w] && st.peers[w].pc && pr && pr.answer && !st.peers[w].answered) {
          st.peers[w].answered = true; st.peers[w].pc.setRemoteDescription(pr.answer).catch(() => {});
        }
      } else {
        const k = pairKey(w, i), pr = pairs[k];
        if (pr && pr.offer && !pr.answer && !st.peers[w]) {
          const p = await peer(w); if (!st || !p.pc) return;
          await p.pc.setRemoteDescription(pr.offer); await p.pc.setLocalDescription(await p.pc.createAnswer()); await gathered(p.pc);
          if (!st || st.peers[w] !== p) return;
          Store.set('call/pairs/' + k + '/answer', p.pc.localDescription.toJSON());
        }
      }
    }
    if (!st) return;
    // alone in the call with nobody else being rung: it is over
    if (Object.keys(joined).length > 1) st.hadOthers = true;
    if (Object.keys(joined).length === 1 && joined[i] && !ringingOthers(c, i).length) { toast(st.hadOthers ? T('The call ended') : T('No answer')); leave(); return; }
    draw();
  }

  /* ---- the screen ---- */
  let shape = '';
  function draw() {
    let el = $('#call');
    if (!st) { if (el) el.remove(); shape = ''; return; }
    if (!el) { el = document.createElement('div'); el.id = 'call'; el.className = 'call'; el.addEventListener('click', onClick); document.body.appendChild(el); }
    const i = self(), c = Store.data.call || {}, ic = st.video ? '📹' : '📞';
    const others = people().filter(w => w !== i);
    let h;
    if (st.pick) h = `<div class="call-mid"><div class="call-ico">${ic}</div><h2>${T('Whom do you want to call?')}</h2></div>`
      + `<div class="call-pick">${others.map(w => `<button class="call-b yes" data-c="to" data-to="${w}">${icon(w)} ${esc(nameOf(w))}</button>`).join('')}`
      + (others.length > 1 ? `<button class="call-b all" data-c="to" data-to="${others.join(',')}">👨‍👩‍👧 ${T('Everyone')}</button>` : '') + '</div>'
      + `<div class="call-btns"><button class="call-b no" data-c="cancel">✕ ${T('Cancel')}</button></div>`;
    else if (st.ringing) {
      const group = Object.keys(c.invited || {}).filter(w => w !== i && w !== st.from);
      h = `<div class="call-mid"><div class="call-ico ringing">${ic}</div><h2>${T('{0} is calling you', esc(nameOf(st.from)))}</h2>`
        + `<p>${st.video ? T('Video call') : T('Voice call')}${group.length ? ' · ' + T('with {0}', group.map(w => esc(nameOf(w))).join(', ')) : ''}</p></div>`
        + `<div class="call-btns"><button class="call-b no" data-c="decline">✕ ${T('Decline')}</button><button class="call-b yes" data-c="answer">${ic} ${T('Answer')}</button></div>`;
    } else {
      // the people in the call (or still being rung) and how far each is
      const want = Object.keys(c.invited || {}).concat(c.from || []).filter((w, n, a) => w && w !== i && a.indexOf(w) === n && !(c.left || {})[w]);
      const tiles = want.map(w => {
        const p = st.peers[w], state = p && p.connected ? '' : (c.joined || {})[w] ? T('Connecting…') : (c.declined || {})[w] ? T('Declined') : T('Ringing…');
        return `<div class="call-tile${p && p.connected ? ' on' : ''}" data-w="${w}">${st.video ? `<video data-peer="${w}" autoplay playsinline></video>` : `<video data-peer="${w}" class="call-audio" autoplay playsinline></video>`}`
          + `<div class="call-face">${icon(w)}</div><div class="call-name">${esc(nameOf(w))}${state ? ` · <span>${state}</span>` : ''}</div></div>`;
      }).join('');
      h = `<div class="call-grid n${Math.min(want.length, 4)}${st.video ? '' : ' voice'}">${tiles}</div>`
        + (st.video ? `<video id="call-local" class="call-local" autoplay playsinline muted></video>` : '')
        + `<div class="call-btns">${st.silent ? `<button class="call-b yes" data-c="sound">🔊 ${T('Turn the sound on')}</button>` : ''}<button class="call-b mute${st.muted ? ' on' : ''}" data-c="mute">${st.muted ? '🔇' : '🎤'}</button><button class="call-b no" data-c="leave">✕ ${T('Hang up')}</button></div>`;
    }
    // rebuilt only when what is shown changes, so the pictures do not flicker
    if (h !== shape) { el.innerHTML = h; shape = h; }
    const l = $('#call-local'); if (l && st.local && l.srcObject !== st.local) l.srcObject = st.local;
    for (const v of el.querySelectorAll('video[data-peer]')) {
      const p = st.peers && st.peers[v.dataset.peer];
      if (p && p.remote && v.srcObject !== p.remote) { v.srcObject = p.remote; v.muted = !!st.silent; play(v); }
    }
  }
  // a browser may refuse to play sound before a tap: then the picture plays without sound and a button turns it on
  function play(v) {
    v.play().catch(() => { if (!st || v.muted) return; v.muted = true; v.play().catch(() => {}); st.silent = true; draw(); });
  }
  function soundOn() {
    if (!st) return; st.silent = false;
    for (const v of document.querySelectorAll('#call video[data-peer]')) { v.muted = false; v.play().catch(() => {}); }
    draw();
  }
  function onClick(e) {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const k = b.dataset.c;
    if (k === 'to') dial(st.video, b.dataset.to.split(','));
    else if (k === 'cancel') close();
    else if (k === 'answer') answer();
    else if (k === 'decline') decline();
    else if (k === 'leave') leave();
    else if (k === 'sound') soundOn();
    else if (k === 'mute' && st && st.local) { st.muted = !st.muted; st.local.getAudioTracks().forEach(t => { t.enabled = !st.muted; }); draw(); }
  }

  Store.on(d => { onData(d).catch(e => console.error(e)); });
  // the call buttons on both screens: data-call="video" or "audio"
  document.addEventListener('click', e => { const b = e.target.closest('[data-call]'); if (b) start(b.dataset.call === 'video'); });
  return { start, leave };
})();
