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

const state = {
  wakeMs: getLastWakeMs(),
  awakeMinutes: getAwakeMinutes(),
};

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

  const { overdue, text } = formatCountdown(bedtimeMs - Date.now());
  els.countdown.textContent = overdue ? `Bedtime was ${text} ago` : `Bedtime in ${text}`;
  els.countdown.classList.toggle('is-overdue', overdue);
}

/**
 * Record the current moment as the wake-up time.
 */
function recordWakeUp() {
  const now = Date.now();

  state.wakeMs = now;
  setLastWakeMs(now);

  render();
}

els.wakeButton.addEventListener('click', recordWakeUp);

render();
