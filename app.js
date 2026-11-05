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
} from './time.js';

import { getAwakeMinutes, getLastWakeMs, setLastWakeMs } from './storage.js';

const els = {
  wakeButton: document.getElementById('wake-button'),
  prediction: document.getElementById('prediction'),
  bedtimeTime: document.getElementById('bedtime-time'),
  countdown: document.getElementById('countdown'),
  wakeTime: document.getElementById('wake-time'),
  awakeDuration: document.getElementById('awake-duration'),
  emptyState: document.getElementById('empty-state'),
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
 * Record the current moment as the wake-up time.
 */
function recordWakeUp() {
  const now = Date.now();

  state.wakeMs = now;
  setLastWakeMs(now);

  render();
  startTimer();
}

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */

els.wakeButton.addEventListener('click', recordWakeUp);

window.addEventListener('hashchange', () => showView(routeFromHash()));

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
render();
startTimer();
