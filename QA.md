# Manual QA checklist

Run through this list before every release. It covers the behaviour that
matters on a real phone.

## How to run the app locally

```bash
npm run serve          # python3 -m http.server 8000
```

Then open `http://localhost:8000` in Chrome. `localhost` counts as a secure
context, so the service worker and notifications work there too.

> The app uses ES modules, so it must be served over HTTP(S). Opening
> `index.html` straight from the file system does not work.

## Automated checks

```bash
npm test               # unit tests for the time and storage helpers
```

The same unit checks also run in the browser: open `tests/tests.html`.

## Checklist

### First run

- [ ] The home screen shows one large **"I woke up"** button.
- [ ] The card below it says that no wake-up has been recorded yet.
- [ ] Nothing is stored in localStorage before the first tap.

### Recording a wake-up

- [ ] Tapping **"I woke up"** shows the predicted bedtime.
- [ ] The predicted bedtime equals the wake-up time plus the awake duration
      (default 16 hours). Example: 7:00 AM shows `11:00 PM`.
- [ ] The countdown reads `Bedtime in 9h 32m` and ticks down live.
- [ ] "Woke up" shows the time of the tap.
- [ ] "Staying awake" shows `16h 00m`.
- [ ] The toast at the bottom says `Wake-up saved at <time>`.

### Undo

- [ ] Tapping **Undo** in the toast restores the previous wake-up time.
- [ ] When there was no previous wake-up, undo clears the card again.
- [ ] The undo toast disappears on its own after about six seconds.

### Double tap

- [ ] A second tap within four hours opens the dialog
      "Replace your wake-up time?".
- [ ] **Keep it** leaves the recorded time untouched.
- [ ] **Replace** stores the new time.
- [ ] Two taps in quick succession record only one wake-up and never open two
      dialogs.

### Settings

- [ ] The awake duration starts at `16h 00m`.
- [ ] `+` adds 15 minutes, `−` removes 15 minutes.
- [ ] The value stops at `1h 00m` and `24h 00m` and the button greys out.
- [ ] The setting survives a reload.
- [ ] Changing the duration immediately updates the predicted bedtime.
- [ ] The "Your bedtime would be" card shows the new bedtime.

### Midnight crossing

- [ ] A wake-up late in the evening produces a bedtime on the next day.
- [ ] The bedtime is labelled `(tomorrow)`.
- [ ] A bedtime earlier today is labelled `(yesterday)`.

### Overdue

- [ ] After the bedtime has passed the countdown reads `Bedtime was 20m ago`
      instead of a negative time.
- [ ] The countdown is highlighted in the warning colour.
- [ ] Right at bedtime it reads `Bedtime is now`.

### History

- [ ] Every wake-up appears in the history, newest first.
- [ ] Each entry shows the date, the awake duration and the bedtime.
- [ ] **Clear history** asks first and then empties the list.
- [ ] Cancelling the dialog keeps the history.

### Notifications

- [ ] The reminder switch starts off.
- [ ] Turning it on asks for the notification permission (a user gesture, not
      on page load).
- [ ] If the permission is blocked, the switch switches back off and a note
      explains why.
- [ ] With the permission granted, a notification arrives 30 minutes before
      the predicted bedtime while the app is open.

### Offline

- [ ] With the network turned off (or DevTools → Network → Offline) the app
      still starts.
- [ ] The button still works and the prediction is still correct.
- [ ] The manifest and the icons are still served.
- [ ] Coming back online does not break anything.

### Time zone

- [ ] Changing the device time zone updates the displayed times.
- [ ] A note appears that the time zone changed.
- [ ] The recorded instant itself does not change.

### Display

- [ ] Times follow the 12 or 24 hour format of the device.
- [ ] Dark mode follows the system setting (DevTools → Rendering →
      Emulate CSS `prefers-color-scheme: dark`).
- [ ] The layout fits a small phone without horizontal scrolling.
- [ ] The button is comfortable to tap with one thumb.

### Update

- [ ] After a new version is deployed, the first reload already shows the new
      files (the service worker cache version was bumped).
