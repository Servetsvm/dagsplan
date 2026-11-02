/* Dagsplan — calls between the child and one parent: voice or video, between the two devices (WebRTC). The child picks
   whom to call (the mother or the father); a parent calls the child. The call is set up through the family's place in the
   database (f/<code>/call): the caller writes its offer with who calls whom, the first device of the person called to
   answer writes the answer, and hanging up removes it. A call reaches only a device that has Dagsplan open (the child's
   screen, or the parent screen opened with that parent's PIN). Between different networks (mobile data and Wi-Fi, two
   homes) the picture and sound go through a relay server (TURN, set in js/config.js). */
'use strict';
const Call = (() => {
  const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const me = rid(8);     // this device: which of the ringing devices answered
  let st = null;         // the call on this device: { id, dir: 'pick' | 'out' | 'in', from, to, video, pc, local, remote, sent, live }
  // who this device is in a call: 'child' on the child's screen, 'mom' or 'dad' on the parent screen
  const self = () => document.body.dataset.role === 'child' ? 'child' : document.body.dataset.role === 'parent' ? App.who() : '';
  const S = () => Store.data.settings || {};
  const parents = () => ['mom', 'dad'].filter(w => S()[w === 'mom' ? 'pin' : 'pin2']);
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
  async function peer(local) {
    const pc = new RTCPeerConnection({ iceServers: await iceServers() });
    local.getTracks().forEach(t => pc.addTrack(t, local));
    pc.ontrack = e => { if (!st) return; st.remote = e.streams[0]; showRemote(); };
    pc.onconnectionstatechange = () => {
      if (!st || st.pc !== pc) return;
      if (pc.connectionState === 'failed') { toast(relayOn() ? T('The call could not connect') : T('The call could not connect: different networks need the relay server (see README)')); end(); }
      else if (pc.connectionState === 'connected') { st.connected = true; draw(); }
    };
    return pc;
  }
  function showRemote() { const v = $('#call-remote'); if (v && st && st.remote && v.srcObject !== st.remote) { v.srcObject = st.remote; v.play().catch(() => {}); } }

  // the child first picks whom to call when both parents have a PIN
  function start(video) {
    const from = self(); if (st || !from) return;
    if (!Store.cloud) { toast(T('Calls need the Firebase settings (see README)')); return; }
    Sound.unlock();
    if (from !== 'child') { dial(video, 'child'); return; }
    const ps = parents();
    if (ps.length === 1) { dial(video, ps[0]); return; }
    st = { dir: 'pick', video }; draw();
  }
  async function dial(video, to) {
    const from = self(); if ((st && st.dir !== 'pick') || !from) return;
    st = null;
    let local; try { local = await media(video); } catch (e) { toast(T('No access to the camera or microphone')); draw(); return; }
    const id = rid(10);
    st = { id, dir: 'out', from, to, video, local };
    draw();
    const pc = st.pc = await peer(local);
    await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
    if (!st || st.id !== id) return;
    Store.set('call', { id, from, to, video: !!video, ts: Date.now(), offer: pc.localDescription.toJSON() }); st.sent = true;
    st.timer = setTimeout(() => { if (st && st.id === id && !st.live) { toast(T('No answer')); end(); } }, 45000);
  }
  async function answer() {
    const c = Store.data.call; if (!st || !c || c.id !== st.id || st.pc) return;
    stopRing();
    let local; try { local = await media(c.video); } catch (e) { toast(T('No access to the camera or microphone')); end(); return; }
    st.local = local; st.pc = true; draw();
    const pc = st.pc = await peer(local);
    await pc.setRemoteDescription(c.offer); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
    if (!st || st.id !== c.id) return;
    Store.update('call', { answer: pc.localDescription.toJSON(), by: me }); st.sent = st.live = true; draw();
  }
  // hang up (or decline): the call ends on every device
  function end() { const c = Store.data.call; if (st && st.id && c && c.id === st.id) Store.remove('call'); close(); }
  function close() {
    if (!st) return;
    clearTimeout(st.timer); stopRing();
    try { st.pc && st.pc.close && st.pc.close(); } catch (e) {}
    if (st.local) st.local.getTracks().forEach(t => t.stop());
    st = null; draw();
  }
  function ring() { stopRing(); Sound.chime(); st.ring = setInterval(() => { Sound.chime(); try { navigator.vibrate && navigator.vibrate(400); } catch (e) {} }, 2500); }
  function stopRing() { if (st && st.ring) { clearInterval(st.ring); st.ring = null; } }

  function onData(d) {
    const c = d.call;
    if (st && st.dir !== 'pick') {
      if (!c || c.id !== st.id) { if (st.sent || st.dir === 'in') { if (st.live || st.dir === 'in') toast(T('The call ended')); close(); } return; }
      if (st.dir === 'out' && c.answer && !st.live) { st.live = true; clearTimeout(st.timer); st.pc.setRemoteDescription(c.answer).catch(() => {}); draw(); }
      if (st.dir === 'in' && c.by && c.by !== me) close();   // answered on another device
      return;
    }
    // a new call to this person rings here (not an old one left behind)
    const i = self();
    if (st || !c || !i || c.to !== i || c.answer || Math.abs(Date.now() - (+c.ts || 0)) > 60000) return;
    st = { id: c.id, dir: 'in', from: c.from, to: c.to, video: !!c.video };
    draw(); ring();
  }

  function draw() {
    let el = $('#call');
    if (!st) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'call'; el.className = 'call'; el.addEventListener('click', onClick); document.body.appendChild(el); }
    const icon = st.video ? '📹' : '📞', name = w => esc(App.nameOf(w));
    let h;
    if (st.dir === 'pick') h = `<div class="call-mid"><div class="call-ico">${icon}</div><h2>${T('Whom do you want to call?')}</h2></div>`
      + `<div class="call-pick">${parents().map(w => `<button class="call-b yes" data-c="to" data-to="${w}">${w === 'mom' ? '👩' : '👨'} ${name(w)}</button>`).join('')}</div>`
      + `<div class="call-btns"><button class="call-b no" data-c="end">✕ ${T('Cancel')}</button></div>`;
    else if (st.dir === 'in' && !st.pc) h = `<div class="call-mid"><div class="call-ico ringing">${icon}</div><h2>${T('{0} is calling you', name(st.from))}</h2><p>${st.video ? T('Video call') : T('Voice call')}</p></div>`
      + `<div class="call-btns"><button class="call-b no" data-c="end">✕ ${T('Decline')}</button><button class="call-b yes" data-c="answer">${icon} ${T('Answer')}</button></div>`;
    else {
      const talking = st.live && st.connected, other = name(st.dir === 'out' ? st.to : st.from);
      const line = talking ? T('Talking with {0}', other) : st.dir === 'out' && !st.live ? T('Calling {0}…', other) : T('Connecting…');
      h = (st.video ? `<video id="call-remote" class="call-remote" autoplay playsinline></video><video id="call-local" class="call-local" autoplay playsinline muted></video>`
        : `<video id="call-remote" class="call-audio" autoplay playsinline></video>`)
        + `<div class="call-mid${st.video && talking ? ' top' : ''}">${st.video && talking ? '' : `<div class="call-ico${st.live ? '' : ' ringing'}">${icon}</div>`}<h2>${line}</h2>${talking ? '' : `<p>${esc(App.nameOf(st.from))} → ${esc(App.nameOf(st.to))}</p>`}</div>`
        + `<div class="call-btns">${st.local ? `<button class="call-b mute${st.muted ? ' on' : ''}" data-c="mute">${st.muted ? '🔇' : '🎤'}</button>` : ''}<button class="call-b no" data-c="end">✕ ${T('Hang up')}</button></div>`;
    }
    el.innerHTML = h;
    const l = $('#call-local');
    if (l && st.local) l.srcObject = st.local;
    showRemote();
  }
  function onClick(e) {
    const b = e.target.closest('[data-c]'); if (!b) return;
    if (b.dataset.c === 'to') dial(st.video, b.dataset.to);
    else if (b.dataset.c === 'answer') answer();
    else if (b.dataset.c === 'end') end();
    else if (b.dataset.c === 'mute' && st && st.local) { st.muted = !st.muted; st.local.getAudioTracks().forEach(t => { t.enabled = !st.muted; }); draw(); }
  }

  Store.on(onData);
  // the call buttons on both screens: data-call="video" or "audio"
  document.addEventListener('click', e => { const b = e.target.closest('[data-call]'); if (b) start(b.dataset.call === 'video'); });
  return { start, end };
})();
