/* Dagsplan — shared helpers: language, dates, which activities fall on a day, stars, pictures and sound. */
'use strict';
const LANGS = { nb: 'Norsk', tr: 'Türkçe', en: 'English' };
let LANG = (() => { try { return localStorage.getItem('dp-lang'); } catch (e) { return null; } })() || 'nb';
// the screens are written in English; T() gives the Norwegian or Turkish text ({0} = a value)
function T(s, ...a) { let r = LANG === 'en' ? s : ((I18N[LANG] || {})[s] || s); a.forEach((v, i) => { r = r.split('{' + i + '}').join(v); }); return r; }
function setLang(l) { LANG = LANGS[l] ? l : 'nb'; try { localStorage.setItem('dp-lang', LANG); } catch (e) {} document.documentElement.lang = LANG; }
const LOCALE = () => ({ nb: 'nb-NO', tr: 'tr-TR', en: 'en-GB' })[LANG];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => ymd(new Date());
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const mins = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const hm = m => pad(Math.floor(m / 60) % 24) + ':' + pad(Math.floor(m % 60));
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
const weekday = s => parseYmd(s).getDay();   // 0 = Sunday
const mondayOf = s => addDays(s, -((weekday(s) + 6) % 7));
const clockOf = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dayName = (s, len = 'long') => parseYmd(s).toLocaleDateString(LOCALE(), { weekday: len });
const dateLong = s => parseYmd(s).toLocaleDateString(LOCALE(), { weekday: 'long', day: 'numeric', month: 'long' });
const dateShort = s => parseYmd(s).toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short' });
// a random id without look-alike letters (family codes are read aloud and typed)
function rid(n = 10) { const A = 'abcdefghjkmnpqrstuvwxyz23456789', b = crypto.getRandomValues(new Uint8Array(n)); let r = ''; for (const x of b) r += A[x % A.length]; return r; }
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const pinHash = (code, pin) => sha('dagsplan:' + code + ':' + pin);

// the categories and their colours (the week view and the cards use them)
const CATS = {
  school: { c: '#3b82f6', n: 'School', e: '🏫' },
  training: { c: '#f97316', n: 'Training', e: '⚽' },
  home: { c: '#16a34a', n: 'Home', e: '🏠' },
  family: { c: '#a855f7', n: 'Family', e: '👨‍👩‍👧' },
  other: { c: '#64748b', n: 'Other', e: '⭐' },
};
const catOf = a => CATS[a && a.cat] || CATS.other;
// pictures to choose from when no photo is added
const EMOJIS = ['🏫', '🎒', '📚', '✏️', '🧮', '💻', '⚽', '🏊', '🚴', '🤸', '🏀', '🎾', '🥋', '🎵', '🎨', '🎮', '📺', '🛏️', '😴', '🚿', '🛁', '🪥', '👕', '👟', '🧥', '🧢', '🍳', '🥣', '🥪', '🍎', '🍽️', '🥤', '💊', '🐶', '🧹', '🧺', '🗑️', '🛒', '🚌', '🚗', '🚶', '👨‍👩‍👧', '👵', '🎂', '🎉', '⛪', '🕌', '📞', '🧘', '🌳', '☀️', '🌙', '⭐', '❤️', '✅', '🩱', '🥽', '🧴', '🔑', '📝'];

// does the activity happen on the day? (once, every day, or on chosen weekdays — days is a string such as '135')
function occurs(a, d) {
  if (!a || !a.title || !a.date) return false;
  if (a.skip && a.skip[d]) return false;
  if (!a.repeat || a.repeat === 'none') return a.date === d;
  if (d < a.date || (a.until && d > a.until)) return false;
  if (a.repeat === 'daily') return true;
  return a.repeat === 'weekly' && String(a.days || '').includes(String(weekday(d)));
}
function dayActs(data, d) {
  return Object.entries((data && data.acts) || {}).filter(([, a]) => occurs(a, d)).map(([id, a]) => ({ ...a, id })).sort((x, y) => mins(x.start) - mins(y.start) || (x.title > y.title ? 1 : -1));
}
const listOf = (data, id) => (id && data.lists && data.lists[id]) || null;
const itemsOf = l => (l && Array.isArray(l.items) ? l.items.filter(Boolean) : Object.values((l && l.items) || {}));
const logOf = (data, d, id) => (((data.log || {})[d] || {})[id]) || {};
// the stars of a week: each finished activity gives its stars (1 when not set)
function weekStars(data, d) {
  const mon = mondayOf(d); let n = 0;
  for (let i = 0; i < 7; i++) {
    const L = (data.log || {})[addDays(mon, i)] || {};
    for (const [id, e] of Object.entries(L)) if (e && e.done) { const a = (data.acts || {})[id]; n += a ? (a.stars == null ? 1 : +a.stars) : 0; }
  }
  return n;
}
// the picture of an activity, list or list item: a photo, else its emoji
const pic = (x, cls = '') => x && x.img ? `<img class="pic ${cls}" src="${esc(x.img)}" alt="">` : `<span class="pic emo ${cls}">${esc((x && x.emoji) || '⭐')}</span>`;

// a shrinking time pie: frac = the part of the time still left (0…1)
function pie(frac, color, size = 64) {
  const f = Math.max(0, Math.min(1, frac)), C = 2 * Math.PI * 8;
  return `<svg class="tpie" width="${size}" height="${size}" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="17" fill="var(--pie-bg)"/>`
    + `<circle cx="18" cy="18" r="8" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${(f * C).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 18 18)"/></svg>`;
}
// a duration in words: "5 min", "1 h 20 min"
function dur(m) { m = Math.max(0, Math.ceil(m)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? T('{0} h {1} min', h, r) : T('{0} h', h)) : T('{0} min', r); }

/* ---- pictures and voice: a photo is made small (it is kept in the database as text); a voice note is up to 30 s ---- */
function shrinkImage(file, max = 360) {
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.78)); }; im.onerror = no; im.src = fr.result; };
    fr.onerror = no; fr.readAsDataURL(file);
  });
}
const Rec = {
  rec: null, timer: null,
  async start(onStop) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const opt = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 24000 } : {};
    const rec = this.rec = new MediaRecorder(stream, opt), parts = [];
    rec.ondataavailable = e => e.data.size && parts.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearTimeout(this.timer); this.rec = null; const fr = new FileReader(); fr.onload = () => onStop(fr.result); fr.readAsDataURL(new Blob(parts, { type: rec.mimeType || 'audio/webm' })); };
    rec.start(); this.timer = setTimeout(() => this.stop(), 30000);
  },
  stop() { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); },
};

/* ---- sound: a soft three-note chime made in the browser (no sound files) ---- */
const Sound = {
  ctx: null,
  unlock() { try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) {} },
  chime() {
    this.unlock(); const c = this.ctx; if (!c) return;
    [784, 988, 1175].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.28;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1);
    });
  },
  cheer() {
    this.unlock(); const c = this.ctx; if (!c) return;
    [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.11; o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.45); });
  },
};
// a YouTube link becomes an embedded player; another link to a video file plays in place
function videoHtml(url) {
  if (!url) return '';
  const y = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  if (y) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${y[1]}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  if (/^https?:\/\//.test(url)) return `<div class="video"><video src="${esc(url)}" controls playsinline></video></div>`;
  return '';
}
function toast(msg) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600);
}
// a small burst of stars when something is finished
function celebrate() {
  Sound.cheer(); const box = document.createElement('div'); box.className = 'burst';
  for (let i = 0; i < 18; i++) { const s = document.createElement('span'); s.textContent = i % 3 ? '⭐' : '🎉'; s.style.setProperty('--dx', (Math.random() * 2 - 1) * 46 + 'vw'); s.style.setProperty('--dy', -(20 + Math.random() * 60) + 'vh'); s.style.animationDelay = (Math.random() * 0.2) + 's'; box.appendChild(s); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 1800);
}
