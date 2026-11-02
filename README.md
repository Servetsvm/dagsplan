# Dagsplan

A visual day plan and reminder app for a child (made for a 12-year-old with ADHD), run from the parent's own phone or PC.
Installable web app (PWA), Norwegian (bokmål) first, with Turkish and English.

- **Child screen** (`#child`): a big clock with the part of the day, today's plan as a picture timeline with a red "now" line,
  the running activity with a shrinking time pie and a countdown to the next one, full-screen reminders (sound, the
  parent's recorded voice, or silent) confirmed with **Ferdig**, picture checklists ticked step by step, the week in
  category colours, stars against a weekly goal, and a "first – then" screen. Nothing can be edited here.
  Holding the clock for 3 seconds asks for the parent PIN and opens the parent screen.
- **Parent screen** (`#parent`): add, edit and repeat activities (once, every day, chosen weekdays, until a date; delete
  one day only), with an emoji or photo, a note, a voice message (up to 30 s), a video link, a checklist and stars;
  make checklists with pictures; see what the child has ticked, finished and confirmed (the Log); send a message that
  pops up full screen on the child's screen right now; set first–then, the star goal, the name and the PIN.

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

The family's data lives at `f/<family code>`. The code is 12 random letters and digits and is the key to the plan:
whoever has the code (or the child's link) can read and change it, so share it only within the family. The parent PIN
only guards the parent screen on the child's device.

## Putting it online (installable on phone, tablet and PC)

Like Bridge: a GitHub repository with GitHub Pages (Settings → Pages → Deploy from branch `main`), or drag the folder onto
https://app.netlify.com/drop. Open the address on each device and choose *Add to Home screen* / *Install app*.
After changing files, raise `VERSION` in `sw.js` so installed devices pick up the new version.

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
| `js/parent.js` | the parent's screen |
| `js/app.js` | setting up / joining a family, the PIN pad, which screen to show |
| `css/style.css` | look and layout |
| `sw.js`, `manifest.webmanifest`, `icons/` | installable / offline app (`tools/icons.ps1` draws the icons) |
| `database.rules.json` | the Realtime Database rules |
