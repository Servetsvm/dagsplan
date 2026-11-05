# Dagsplan

A visual day plan and reminder app for a child (made for a 12-year-old with ADHD), run from the parent's own phone or PC.
Installable web app (PWA), Norwegian (bokmål) first, with Turkish and English.

- **Child screen** (`#child`): a big clock with the part of the day, today's plan as a picture timeline with a red "now" line,
  the running activity with a shrinking time pie and a countdown to the next one, full-screen reminders (sound, the
  parent's recorded voice, or silent) confirmed with **Ferdig**, picture checklists ticked step by step, the week in
  category colours, stars against a weekly goal, and a "first – then" screen. Nothing can be edited here.
  The **🔒 Parent** button (or holding the clock for 3 seconds) asks for a parent PIN and opens the parent screen.
- **Parent screen** (`#parent`): add, edit and repeat activities (once, every day, chosen weekdays, until a date; delete
  one day only), with an emoji or photo, a note, a voice message (up to 30 s), a video link, a checklist and stars;
  make checklists with pictures; see what the child has ticked, finished and confirmed (the Log); send a message that
  pops up full screen on the child's screen right now; set first–then, the star goal, the name and the PINs.

## Trying it on this computer

```
node tools/serve.js
```

Open http://localhost:8780. Without Firebase settings the app runs in **local mode**: the plan is kept in this browser,
and the parent and child screens sync only between tabs of the same browser (open `#parent` in one tab, `#child` in another).

## Connecting Firebase (needed to sync between the parent's phone and the child's devices)

1. https://console.firebase.google.com → **Add project** (e.g. `dagsplan`). Google Analytics is not needed.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.** (Every device signs in with a hidden
   guest account; nobody types a password.)
3. **Build → Realtime Database → Create database**, location *europe-west1 (Belgium)*, start in **locked mode**.
   Then the **Rules** tab: paste the contents of `database.rules.json` and **Publish**.
4. **Project settings (⚙️) → General → Your apps → Web (`</>`)**, register an app (no Hosting needed). From the config
   it shows, copy `apiKey` and `databaseURL` into `js/config.js`.
5. Raise `VERSION` in `sw.js`, and put the folder on a host (below).

The family's data lives at `f/<family code>`. The code is 12 random letters and digits, carried in the child's link
(Settings → Copy / Share); nobody types it. It is the key to the plan: whoever has the link can read and change it, so
share it only within the family. Other devices (the child's, the other parent's) join by opening that link.

**The family password** keeps the site to the family: the bare address shows only a family password box, and only the
right password opens the plan on a new device (which then asks whether the child or a parent uses it). The database keeps
not the password but its hash, at `gate/<hash>` → the family code; the rules let a signed-in device read one such entry
by its exact hash, never list them, and only create or delete an entry, never change one. The parents set or change
the password in Settings → Family password. A new plan is made at the address `#new` (on a device with no plan yet).

The PINs only guard the screens on a device:
- **the mother's PIN** and **the father's PIN** (optional): the parent screen first asks who you are, then that parent's
  PIN; either PIN also opens the child's screen. Each parent changes only their own PIN (and the child's); the other
  parent's PIN can be set only while it is not set yet. Messages and calls from the parent screen carry that parent's name;
- **the child's PIN** (optional): opens the child's screen until the app is closed, never the parent screen.
Opening the child's screen locks the parent screen again, so going back to it needs a parent PIN.

## Putting it online (installable on phone, tablet and PC)

Like Bridge: a GitHub repository with GitHub Pages (Settings → Pages → Deploy from branch `main`), or drag the folder onto
https://app.netlify.com/drop. Open the address on each device and choose *Add to Home screen* / *Install app*.
After changing files, raise `VERSION` in `sw.js` so installed devices pick up the new version.

## Several children

Settings → the child card → **Add a child**. With more than one child the parent screen shows whose plan it is (a row of
names at the top): the plan, the log, the stars, the message and first–then are each child's own. A new activity is for
the child shown, or for every child (**For whom?** in the editor). Each child has their own PIN, and each device's
child's screen is for one child (asked when the device joins with the family password, or Settings → This device). The
first child keeps its data where it was (settings, log/); a further child is settings/kids/<id> with its ticks in klog/<id>.

## Calls

The 📹 (video) and 📞 (voice) buttons at the top of both screens start a call. The child picks whom to call (the mother
or the father) and only that parent's devices ring (where the parent screen is open with that parent's PIN); a parent
calls the child's screens. Both sides see who calls whom. The first device to answer takes the call. The picture and sound go straight between the two devices (WebRTC); the database only carries
the set-up (`f/<code>/call`), which is removed when the call ends.

- A call reaches a device with Dagsplan **open** on the child's or the parent screen. A phone where Dagsplan is closed
  rings through the free **ntfy** app: each family member has a secret ntfy topic (settings/ntfy/<who>), their phone's
  ntfy app subscribes to it once (Settings → Calls when Dagsplan is closed), and a call sends "… is calling you" to the
  topics of the people called; tapping it opens Dagsplan to answer. Only that line of text goes through ntfy.sh.
- The browser asks once for the camera and the microphone.
- Between different networks (a phone on mobile data and a PC on Wi-Fi, two homes) the devices usually cannot reach
  each other directly, and the call needs a **relay server (TURN)**. Make a free account at https://www.metered.ca/stun-turn
  (TURN Server → create an app → copy the credentials API address with its apiKey) and put that address in `TURN.url` in
  `js/config.js`. Without it the call says it could not connect.

## What reminders can and cannot do (web app limits)

| Situation on the child's device | Reminder |
|---|---|
| Dagsplan open on screen (e.g. a tablet on the wall or a stand, screen kept on) | Full-screen card with sound or voice, every time, on the minute. The app asks the browser to keep the screen on. |
| Dagsplan installed and open, but in the background / screen off | A system notification (if allowed under *Allow notifications*); Android may deliver it up to a minute or more late. |
| Dagsplan closed | **No reminder.** A web app cannot wake itself up at a set time. |

What would close the gap later:
- **Server push**: a scheduled Firebase Cloud Function that sends a web push at each activity's time. It works with the
  app closed on Android (not reliably on iPhone), but needs the Firebase *Blaze* (pay-as-you-go) plan and a little
  server code.
- **An Android wrapper** (Capacitor or a Trusted Web Activity) using exact alarms: reliable alarms, a lock-task "kiosk"
  mode, and starting on boot. This is the real fix if the phone must ring with the app closed.

Until then: keep the child's screen open on a tablet at home, and on the phone use Android's *screen pinning*
(Settings → Security → App pinning) to keep the child in Dagsplan.

## Files

| File | Contents |
|---|---|
| `index.html` | the page |
| `js/config.js` | the Firebase settings (empty = local mode) |
| `js/lang.js` | the texts in Norwegian and Turkish (`node tools/strings.js` lists missing ones) |
| `js/core.js` | dates, repeat rules, stars, pictures, sound |
| `js/store.js` | the family's data and the live sync (Firebase REST + EventSource, or this browser) |
| `js/child.js` | the child's screen and reminders |
| `js/call.js` | voice and video calls between the screens |
| `js/parent.js` | the parent's screen |
| `js/app.js` | setting up a family, the PIN pad and the PINs, which screen to show |
| `css/style.css` | look and layout |
| `sw.js`, `manifest.webmanifest`, `icons/` | installable / offline app (`tools/icons.ps1` draws the icons) |
| `database.rules.json` | the Realtime Database rules |
