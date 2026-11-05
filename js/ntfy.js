/* Dagsplan — a call rings a phone even when Dagsplan is closed there, through the free ntfy app (ntfy.sh): each family
   member has a secret ntfy topic (settings/ntfy/<who> = { t: topic, lang }), their phone's ntfy app subscribes to it once,
   and a call sends "… is calling" to the topics of the people called. Tapping the notification opens Dagsplan, where the
   call is answered. Only that line of text goes through ntfy.sh; the topic names stay in the family's data. */
'use strict';
const Ntfy = (() => {
  const SERVER = 'https://ntfy.sh';
  const S = () => Store.data.settings || {};
  const topicOf = w => ((S().ntfy || {})[w] || {}).t || '';
  // the people who can be called: the parents with a PIN, and the children
  const people = () => ['mom', 'dad'].filter(w => S()[w === 'mom' ? 'pin' : 'pin2']).concat(kidsOf(S()).map(k => k.id));
  // a topic for everyone who has none yet (long and random, so nobody can guess it)
  function ensure() {
    if (!Store.cloud || !S().pin) return;
    const up = {};
    for (const w of people()) if (!topicOf(w)) up[w + '/t'] = 'dagsplan-' + rid(24);
    if (Object.keys(up).length) Store.update('settings/ntfy', up);
  }
  // the language this person's notifications come in: the one their Dagsplan was last opened in
  function seen(who) { if (who && topicOf(who) && ((S().ntfy || {})[who] || {}).lang !== LANG) Store.set(`settings/ntfy/${who}/lang`, LANG); }
  // a text in another person's language
  const TL = (lang, s, ...a) => { let r = lang === 'en' ? s : ((I18N[lang] || {})[s] || s); a.forEach((v, i) => { r = r.split('{' + i + '}').join(v); }); return r; };
  const site = () => location.href.split('#')[0];
  function send(who, title, message, tags, screen) {
    const t = topicOf(who); if (!t) return Promise.resolve(false);
    return fetch(SERVER, { method: 'POST', body: JSON.stringify({ topic: t, title, message, tags, priority: 5, click: site() + '#' + screen }) })
      .then(r => r.ok).catch(() => false);
  }
  // a call: each person called gets "<caller> is calling" in their own language
  function ring(from, to, video) {
    for (const w of to) {
      const lang = ((S().ntfy || {})[w] || {}).lang || LANG;
      const others = to.filter(x => x !== w).map(x => App.nameOf(x));
      const body = TL(lang, video ? 'Video call' : 'Voice call') + (others.length ? ' · ' + TL(lang, 'with {0}', others.join(', ')) : '') + ' — ' + TL(lang, 'Tap to answer');
      send(w, TL(lang, '{0} is calling you', App.nameOf(from)), body, [video ? 'video_camera' : 'telephone_receiver'], w === 'mom' || w === 'dad' ? 'parent' : 'child');
    }
  }
  const test = who => send(who, 'Dagsplan', T('This phone will ring when someone calls {0}.', App.nameOf(who)), ['white_check_mark'], who === 'mom' || who === 'dad' ? 'parent' : 'child');
  // the ntfy app opens this to subscribe; the web address is for typing the topic by hand
  const link = who => topicOf(who) ? 'ntfy://ntfy.sh/' + topicOf(who) : '';
  return { ensure, seen, ring, test, link, topicOf };
})();
