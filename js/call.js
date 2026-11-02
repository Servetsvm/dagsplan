/* Dagsplan — calls between the child's screen and the parents' screens: voice or video, straight between the two
   devices (WebRTC). The call is set up through the family's place in the database (f/<code>/call): the caller writes
   its offer, the first device on the other side to answer writes the answer, and hanging up removes it. A call reaches
   only a device that has Dagsplan open on the child's or the parent screen. */
'use strict';
const Call = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const me = rid(8);     // this device: which of the ringing devices answered
  let st = null;         // the call on this device: { id, dir: 'out' | 'in', from, video, pc, local, remote, sent, live }
  const side = () => ({ child: 'child', parent: 'parent' })[document.body.dataset.role] || '';
  const S = () => Store.data.settings || {};
  // the name of one side: the child's, or the parents' together
  const nameOf = sd => sd === 'child' ? (S().child || T('the child')) : ([S().mom, S().dad].filter(Boolean).join(' / ') || T('Home'));

  // the offer and the answer are sent whole, once the network addresses are gathered (no trickling)
  const gathered = pc => new Promise(done => {
    if (pc.iceGatheringState === 'complete') return done();
    const t = setTimeout(done, 4000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); done(); } });
  });
  const media = video => navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user', width: { ideal: 640 } } : false });
  function peer(local) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    local.getTracks().forEach(t => pc.addTrack(t, local));
    pc.ontrack = e => { if (!st) return; st.remote = e.streams[0]; const v = $('#call-remote'); if (v && v.srcObject !== st.remote) v.srcObject = st.remote; };
    pc.onconnectionstatechange = () => {
      if (!st || st.pc !== pc) return;
      if (pc.connectionState === 'failed') { toast(T('The call could not connect')); end(); }
      else if (pc.connectionState === 'connected') { st.connected = true; draw(); }
    };
    return pc;
  }

  async function dial(video) {
    const sd = side(); if (st || !sd) return;
    if (!Store.cloud) { toast(T('Calls need the Firebase settings (see README)')); return; }
    Sound.unlock();
    let local; try { local = await media(video); } catch (e) { toast(T('No access to the camera or microphone')); return; }
    const id = rid(10), pc = peer(local);
    st = { id, dir: 'out', from: sd, video, pc, local };
    draw();
    await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
    if (!st || st.id !== id) return;
    // a parent's call says which parent is calling
    Store.set('call', { id, from: sd, name: sd === 'parent' ? App.whoName() : '', video: !!video, ts: Date.now(), offer: pc.localDescription.toJSON() }); st.sent = true;
    st.timer = setTimeout(() => { if (st && st.id === id && !st.live) { toast(T('No answer')); end(); } }, 45000);
  }
  async function answer() {
    const c = Store.data.call; if (!st || !c || c.id !== st.id || st.pc) return;
    stopRing();
    let local; try { local = await media(c.video); } catch (e) { toast(T('No access to the camera or microphone')); end(); return; }
    const pc = peer(local); Object.assign(st, { pc, local }); draw();
    await pc.setRemoteDescription(c.offer); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
    if (!st || st.id !== c.id) return;
    Store.update('call', { answer: pc.localDescription.toJSON(), by: me }); st.sent = st.live = true; draw();
  }
  // hang up (or decline): the call ends on every device
  function end() { const c = Store.data.call; if (st && c && c.id === st.id) Store.remove('call'); close(); }
  function close() {
    if (!st) return;
    clearTimeout(st.timer); stopRing();
    try { st.pc && st.pc.close(); } catch (e) {}
    if (st.local) st.local.getTracks().forEach(t => t.stop());
    st = null; draw();
  }
  function ring() { stopRing(); Sound.chime(); st.ring = setInterval(() => { Sound.chime(); try { navigator.vibrate && navigator.vibrate(400); } catch (e) {} }, 2500); }
  function stopRing() { if (st && st.ring) { clearInterval(st.ring); st.ring = null; } }

  function onData(d) {
    const c = d.call, sd = side();
    if (st) {
      if (!c || c.id !== st.id) { if (st.sent || st.dir === 'in') { if (st.live || st.dir === 'in') toast(T('The call ended')); close(); } return; }
      if (st.dir === 'out' && c.answer && !st.live) { st.live = true; clearTimeout(st.timer); st.pc.setRemoteDescription(c.answer).catch(() => {}); draw(); }
      if (st.dir === 'in' && c.by && c.by !== me) close();   // answered on another device
      return;
    }
    // a new call from the other side rings here (not an old one left behind)
    if (!c || !sd || c.from === sd || c.answer || Math.abs(Date.now() - (+c.ts || 0)) > 60000) return;
    st = { id: c.id, dir: 'in', from: c.from, name: c.name, video: !!c.video };
    draw(); ring();
  }

  function draw() {
    let el = $('#call');
    if (!st) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'call'; el.className = 'call'; el.addEventListener('click', onClick); document.body.appendChild(el); }
    const who = esc(st.name || nameOf(st.dir === 'in' ? st.from : st.from === 'child' ? 'parent' : 'child'));
    const icon = st.video ? '📹' : '📞';
    let h;
    if (st.dir === 'in' && !st.pc) h = `<div class="call-mid"><div class="call-ico ringing">${icon}</div><h2>${T('{0} is calling', who)}</h2><p>${st.video ? T('Video call') : T('Voice call')}</p></div>`
      + `<div class="call-btns"><button class="call-b no" data-c="end">✕ ${T('Decline')}</button><button class="call-b yes" data-c="answer">${icon} ${T('Answer')}</button></div>`;
    else {
      const talking = st.live && st.connected;
      h = (st.video ? `<video id="call-remote" class="call-remote" autoplay playsinline></video><video id="call-local" class="call-local" autoplay playsinline muted></video>`
        : `<video id="call-remote" class="call-audio" autoplay playsinline></video>`)
        + `<div class="call-mid${st.video && talking ? ' top' : ''}">${st.video && talking ? '' : `<div class="call-ico${st.live ? '' : ' ringing'}">${icon}</div>`}<h2>${who}</h2><p>${talking ? T('Connected') : st.live ? T('Connecting…') : T('Calling…')}</p></div>`
        + `<div class="call-btns">${st.local ? `<button class="call-b mute${st.muted ? ' on' : ''}" data-c="mute">${st.muted ? '🔇' : '🎤'}</button>` : ''}<button class="call-b no" data-c="end">✕ ${T('Hang up')}</button></div>`;
    }
    el.innerHTML = h;
    const r = $('#call-remote'), l = $('#call-local');
    if (r && st.remote) r.srcObject = st.remote;
    if (l && st.local) l.srcObject = st.local;
  }
  function onClick(e) {
    const b = e.target.closest('[data-c]'); if (!b) return;
    if (b.dataset.c === 'answer') answer();
    else if (b.dataset.c === 'end') end();
    else if (b.dataset.c === 'mute' && st && st.local) { st.muted = !st.muted; st.local.getAudioTracks().forEach(t => { t.enabled = !st.muted; }); draw(); }
  }

  Store.on(onData);
  // the call buttons on both screens: data-call="video" or "audio"
  document.addEventListener('click', e => { const b = e.target.closest('[data-call]'); if (b) dial(b.dataset.call === 'video'); });
  return { dial, end };
})();
