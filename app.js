/**
 * Sleep Predictor - application logic.
 *
 * The app has three screens (home, settings, history) that are switched with
 * the URL hash. All state lives in localStorage, so the app works offline and
 * survives a restart without any backend.
 */

import {
  predictBedtime,
  formatTime,
  formatCountdown,
  formatDurationMinutes,
  dayOffset,
  formatDayOffsetLabel,
} from './time.js';

import {
  getAwakeMinutes,
  getLastWakeMs,
  setLastWakeMs,
  setAwakeMinutes,
  DEFAULTS,
} from './storage.js';

const els = {
  wakeButton: document.getElementById('wake-button'),
  prediction: document.getElementById('prediction'),
  bedtimeTime: document.getElementById('bedtime-time'),
  countdown: document.getElementById('countdown'),
  wakeTime: document.getElementById('wake-time'),
  awakeDuration: document.getElementById('awake-duration'),
  emptyState: document.getElementById('empty-state'),
  durationValue: document.getElementById('duration-value'),
  durationDecrease: document.getElementById('duration-decrease'),
  durationIncrease: document.getElementById('duration-increase'),
  settingsPreview: document.getElementById('settings-preview'),
  previewBedtime: document.getElementById('preview-bedtime'),
  previewHint: document.getElementById('preview-hint'),
  confirmDialog: document.getElementById('confirm-dialog'),
  confirmTime: document.getElementById('confirm-time'),
};

/** The screens of the app and the element that holds them. */
const VIEWS = {
  home: 'view-home',
  settings: 'view-settings',
};

const state = {
  wakeMs: getLastWakeMs(),
  awakeMinutes: getAwakeMinutes(),
};

let timerId = null;
let lastCountdownLabel = '';
let lastTapAt = 0;

/** A wake-up older than this is treated as a new day, not a double tap. */
const RECENT_TAP_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Taps that arrive faster than this are ignored. */
const TAP_DEBOUNCE_MS = 700;

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

/**
 * The screen that the current URL hash points at.
 * @returns {string} a key of `VIEWS`
 */
function routeFromHash() {
  const name = (window.location.hash || '').replace(/^#\/?/, '');
  return Object.prototype.hasOwnProperty.call(VIEWS, name) ? name : 'home';
}

/**
 * Show one screen and hide the others.
 * @param {string} name a key of `VIEWS`
 */
function showView(name) {
  for (const [route, id] of Object.entries(VIEWS)) {
    document.getElementById(id).hidden = route !== name;
  }

  for (const link of document.querySelectorAll('[data-nav]')) {
    const isActive = link.dataset.nav === name;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

/**
 * Draw the current state into the DOM.
 */
function render() {
  const { wakeMs, awakeMinutes } = state;

  renderPreview();

  if (wakeMs === null) {
    els.prediction.hidden = true;
    els.emptyState.hidden = false;
    return;
  }

  els.emptyState.hidden = true;
  els.prediction.hidden = false;

  const bedtimeMs = predictBedtime(wakeMs, awakeMinutes);

  els.wakeTime.textContent = formatTime(wakeMs);
  els.awakeDuration.textContent = formatDurationMinutes(awakeMinutes);
  els.bedtimeTime.textContent = formatTime(bedtimeMs);

  updateCountdown(bedtimeMs);
}

/**
 * Update the live countdown. The DOM is only touched when the text changes,
 * so a one second tick stays cheap.
 *
 * @param {number} bedtimeMs
 */
function updateCountdown(bedtimeMs) {
  const remaining = bedtimeMs - Date.now();
  const { overdue, text } = formatCountdown(remaining);
  const label = overdue ? `Bedtime was ${text} ago` : `Bedtime in ${text}`;

  if (label === lastCountdownLabel) return;

  lastCountdownLabel = label;
  els.countdown.textContent = label;
  els.countdown.classList.toggle('is-overdue', overdue);
}

/* ------------------------------------------------------------------ *
 * Awake duration stepper
 * ------------------------------------------------------------------ */

/**
 * Show the current awake duration and grey out the buttons that would leave
 * the allowed range.
 */
function updateStepper() {
  els.durationValue.textContent = formatDurationMinutes(state.awakeMinutes);
  els.durationDecrease.disabled = state.awakeMinutes <= DEFAULTS.minAwakeMinutes;
  els.durationIncrease.disabled = state.awakeMinutes >= DEFAULTS.maxAwakeMinutes;
}

/**
 * Move the awake duration by one step, save it and apply it right away.
 * @param {number} deltaMinutes
 */
function changeAwakeMinutes(deltaMinutes) {
  state.awakeMinutes = setAwakeMinutes(state.awakeMinutes + deltaMinutes);
  updateStepper();
  render();
}

/**
 * Show which bedtime the current awake duration would produce.
 */
function renderPreview() {
  if (state.wakeMs === null) {
    els.settingsPreview.hidden = true;
    return;
  }

  els.settingsPreview.hidden = false;

  const bedtimeMs = predictBedtime(state.wakeMs, state.awakeMinutes);
  const offset = dayOffset(state.wakeMs, bedtimeMs);

  els.previewBedtime.textContent = formatTime(bedtimeMs);
  els.previewHint.textContent = `Bedtime is ${formatDayOffsetLabel(offset)}`;
}

/* ------------------------------------------------------------------ *
 * Countdown timer
 * ------------------------------------------------------------------ */

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    if (state.wakeMs === null) return;
    updateCountdown(predictBedtime(state.wakeMs, state.awakeMinutes));
  }, 1000);
}

function stopTimer() {
  if (timerId === null) return;
  window.clearInterval(timerId);
  timerId = null;
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

/**
 * Store a wake-up time as the current one.
 * @param {number} now epoch milliseconds
 */
function applyWakeUp(now) {
  state.wakeMs = now;
  setLastWakeMs(now);

  render();
  startTimer();
}

/**
 * Ask whether an existing wake-up time should be replaced.
 * @param {number} now epoch milliseconds
 */
function confirmReplace(now) {
  els.confirmTime.textContent = formatTime(state.wakeMs);

  if (typeof els.confirmDialog.showModal !== 'function') {
    // Very old browsers without <dialog> support.
    if (window.confirm('Replace your wake-up time?')) applyWakeUp(now);
    return;
  }

  if (els.confirmDialog.open) return;

  els.confirmDialog.returnValue = 'cancel';
  els.confirmDialog.showModal();
}

/**
 * Handle a tap on the "I woke up" button.
 *
 * A wake-up that was recorded a short while ago is probably a double tap, so
 * the user gets asked before it is replaced. Very fast taps are ignored.
 */
function requestWakeUp() {
  const now = Date.now();

  if (now - lastTapAt < TAP_DEBOUNCE_MS) return;
  lastTapAt = now;

  const previousWakeMs = state.wakeMs;
  const isRecent = previousWakeMs !== null && now - previousWakeMs < RECENT_TAP_WINDOW_MS;

  if (isRecent) {
    confirmReplace(now);
    return;
  }

  applyWakeUp(now);
}

/**
 * Handle the "I woke up" shortcut of the installed app.
 *
 * On Android the launcher can start the app with `?action=wake`, which
 * records a wake-up right away.
 */
function handleLaunchAction() {
  const action = new URLSearchParams(window.location.search).get('action');
  if (action !== 'wake') return;

  requestWakeUp();

  // Drop the action from the URL so a reload does not record it twice.
  const url = new URL(window.location.href);
  url.searchParams.delete('action');
  window.history.replaceState({}, '', url);
}

/* ------------------------------------------------------------------ *
 * Service worker
 * ------------------------------------------------------------------ */
/**
 * Register the service worker so the app keeps working offline.
 * Registration only works over HTTPS (or on localhost) and is skipped
 * gracefully when the browser does not support it.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('The service worker could not be registered:', error);
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */

els.wakeButton.addEventListener('click', requestWakeUp);

els.confirmDialog.addEventListener('close', () => {
  if (els.confirmDialog.returnValue === 'replace') applyWakeUp(Date.now());
});

els.durationDecrease.addEventListener('click', () => changeAwakeMinutes(-DEFAULTS.stepMinutes));
els.durationIncrease.addEventListener('click', () => changeAwakeMinutes(DEFAULTS.stepMinutes));

window.addEventListener('hashchange', () => {
  showView(routeFromHash());
  render();
});

// Pause the timer while the app is in the background and refresh the numbers
// when it comes back - the time zone or the clock may have changed.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopTimer();
    return;
  }
  render();
  startTimer();
});

showView(routeFromHash());
updateStepper();
render();
startTimer();
handleLaunchAction();
registerServiceWorker();
