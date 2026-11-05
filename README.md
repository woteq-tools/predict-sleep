# Sleep Predictor

An Android-friendly Progressive Web App (PWA) that predicts when you should go to sleep next, based on when you woke up.

Tap one big button when you wake up, and the app tells you when to go to bed.

## Goal

Most of us do not know how much sleep we actually need. This app makes the rule explicit and enforceable:

> **bedtime = wake-up time + awake duration** (default **16 hours**)

Tap **"I woke up"** at 7:00 AM and the app shows **"Predicted bedtime: 11:00 PM"**, along with a live countdown so you always know how long you have left.

## Spec

### Core behavior

- The home screen has a single large button labeled **"I woke up"**.
- When the user taps it, the app records the current time as the wake-up time.
- The app then adds a configurable **awake duration** (default: **16 hours**) to the wake-up time and displays the predicted bedtime.
- Example: if the user taps the button at 7:00 AM, the app shows `Predicted bedtime: 11:00 PM`.

### Settings

- A settings screen lets the user change the awake duration (default 16 hours, adjustable in **15-minute steps**).
- The setting is saved and applied to all future predictions.

### Display

- Show the last wake-up time, the predicted bedtime, and a live countdown (`Bedtime in 9h 32m`).
- Use the device's local time zone and the user's 12/24-hour format.

### Optional features

- Send a notification **30 minutes before** the predicted bedtime.
- Keep a simple **history** of past wake-up times and bedtimes.

### Technical requirements

- Installable PWA with a manifest and a service worker, working **offline**.
- Store all data **locally** (localStorage). No backend or account is required.
- Mobile-first, clean, minimal UI with **dark mode** support.
- Handle edge cases: tapping the button twice, a predicted time that falls on the next day, and time zone changes.

## Tech stack

Plain HTML, CSS and JavaScript. No build step, no framework, no runtime dependencies.

| File | Purpose |
| --- | --- |
| `index.html` | App shell and all three views (home / settings / history) |
| `styles.css` | Mobile-first styling, CSS variables, dark mode |
| `app.js` | View routing, rendering, event wiring, countdown loop, notifications |
| `time.js` | Pure time helpers (prediction, formatting, countdown) |
| `storage.js` | Safe `localStorage` wrappers and the data model |
| `sw.js` | Service worker: precache, cache-first serving, offline support |
| `manifest.json` | Web app manifest for installability |
| `icons/` | Generated PNG app icons (192, 512, maskable 512, apple touch, favicon) |
| `tests/` | Unit checks for the time helpers (Node test runner + browser page) |

## Architecture notes

- **Pure logic lives in `time.js`.** It has no DOM or storage dependencies, so it can be unit tested directly under Node.
- **Timestamps are stored as epoch milliseconds** and the awake duration is stored as an **integer number of minutes**. Both are absolute and timezone-agnostic, which makes timezone changes a non-issue for stored data.
- **Formatting uses `Intl.DateTimeFormat(undefined, ...)`,** so times follow the device locale's 12/24-hour preference and the device's local time zone automatically.
- **ES modules** are used for the app code. This requires the app to be served over HTTP(S) — opening `index.html` directly from the filesystem will not work (browser module security rules). PWA installation also requires HTTPS anyway.

## Development

Serve the folder over HTTP (any static server works):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Run the unit tests:

```bash
node --test tests/
```

The same checks can also be run in a browser by opening `tests/tests.html`.

## License

MIT
