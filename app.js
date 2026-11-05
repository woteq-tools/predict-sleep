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
  formatDateShort,
  formatCountdownLabel,
  formatDurationMinutes,
  dayOffset,
  formatDayOffsetLabel,
  currentZone,
} from './time.js';

import {
  KEYS,
  getAwakeMinutes,
  getLastWakeMs,
  setLastWakeMs,
  clearLastWakeMs,
  getSavedZone,
  setSavedZone,
  removeItem,
  getHistory,
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
  setAwakeMinutes,
  DEFAULTS,
} from './storage.js';

const els = {
  wakeButton: document.getElementById('wake-button'),
  prediction: document.getElementById('prediction'),
  bedtimeTime: document.getElementById('bedtime-time'),
  bedtimeDay: document.getElementById('bedtime-day'),
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
  confirmTitle: document.getElementById('confirm-title'),
  confirmText: document.getElementById('confirm-text'),
  confirmAccept: document.getElementById('confirm-accept'),
  confirmCancel: document.getElementById('confirm-cancel'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
  toastUndo: document.getElementById('toast-undo'),
  zoneNote: document.getElementById('zone-note'),
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  historyClear: document.getElementById('history-clear'),
};

/** The screens of the app and the element that holds them. */
const VIEWS = {
  home: 'view-home',
  settings: 'view-settings',
  history: 'view-history',
};

const state = {
  wakeMs: getLastWakeMs(),
  awakeMinutes: getAwakeMinutes(),
};

let timerId = null;
let lastCountdownLabel = '';
let lastTapAt = 0;
let toastTimer = null;
let undoHandler = null;

/** A wake-up older than this is treated as a new day, not a double tap. */
const RECENT_TAP_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Taps that arrive faster than this are ignored. */
const TAP_DEBOUNCE_MS = 700;

/** How long the undo toast stays on screen. */
const TOAST_DURATION_MS = 6000;

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

  renderHistory();

  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

/**
 * Warn the user when the device time zone no longer matches the zone the
 * wake-up was recorded in. The stored instant stays correct either way, only
 * the way it is written out changes.
 */
function renderZoneNote() {
  const savedZone = getSavedZone();
  const current = currentZone();

  if (!savedZone || savedZone === 'unknown' || current === 'unknown' || savedZone === current) {
    els.zoneNote.hidden = true;
    return;
  }

  els.zoneNote.hidden = false;
  els.zoneNote.textContent = `Your time zone changed to ${current.replace(/_/g, ' ')}. The times below use the new zone.`;
}

/**
 * Draw the current state into the DOM.
 */
function render() {
  const { wakeMs, awakeMinutes } = state;

  renderPreview();
  renderZoneNote();
  renderHistory();

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

  // Say which day the bedtime is on when it is not today.
  const dayDelta = dayOffset(Date.now(), bedtimeMs);
  els.bedtimeDay.textContent = dayDelta === 0 ? '' : ` (${formatDayOffsetLabel(dayDelta)})`;

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
  const { label, overdue } = formatCountdownLabel(remaining);

  if (label === lastCountdownLabel) return;

  lastCountdownLabel = label;
  els.countdown.textContent = label;
  els.countdown.classList.toggle('is-overdue', overdue);
}

/* ------------------------------------------------------------------ *
 * History
 * ------------------------------------------------------------------ */

/**
 * A small helper to build an element.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Draw the recorded wake-ups into the history list.
 */
function renderHistory() {
  const entries = getHistory();

  els.historyList.textContent = '';
  els.historyEmpty.hidden = entries.length > 0;
  els.historyClear.hidden = entries.length === 0;

  for (const entry of entries) {
    const item = el('li', 'history__item');

    const head = el('div', 'history__head');
    head.append(
      el('span', 'history__date', formatDateShort(entry.wakeMs)),
      el('span', 'history__duration', formatDurationMinutes(entry.awakeMinutes)),
    );

    // Show the date too when the bedtime is on another calendar day.
    const nextDay = dayOffset(entry.wakeMs, entry.bedtimeMs) !== 0;
    const bedtime = nextDay
      ? `Bedtime ${formatDateShort(entry.bedtimeMs)} ${formatTime(entry.bedtimeMs)}`
      : `Bedtime ${formatTime(entry.bedtimeMs)}`;

    const detail = el('div', 'history__detail');
    detail.append(
      el('span', 'history__wake', `Woke up ${formatTime(entry.wakeMs)}`),
      el('span', 'history__arrow', '→'),
      el('span', 'history__bedtime', bedtime),
    );

    item.append(head, detail);
    els.historyList.append(item);
  }
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
  const offset = dayOffset(Date.now(), bedtimeMs);

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
 * Dialog
 * ------------------------------------------------------------------ */

/**
 * Ask the user a yes/no question.
 *
 * @param {{title: string, text: string, acceptLabel?: string, cancelLabel?: string}} options
 * @returns {Promise<boolean>} true when the user accepted
 */
function askConfirm({ title, text, acceptLabel = 'OK', cancelLabel = 'Cancel' }) {
  // Very old browsers without <dialog> support.
  if (typeof els.confirmDialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(text));
  }

  if (els.confirmDialog.open) return Promise.resolve(false);

  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmAccept.textContent = acceptLabel;
  els.confirmCancel.textContent = cancelLabel;
  els.confirmDialog.returnValue = 'cancel';

  return new Promise((resolve) => {
    els.confirmDialog.addEventListener(
      'close',
      () => resolve(els.confirmDialog.returnValue === 'accept'),
      { once: true },
    );
    els.confirmDialog.showModal();
  });
}

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */

/**
 * Show a short lived message, optionally with an undo action.
 * @param {string} message
 * @param {(() => void)|null} [onUndo]
 */
function showToast(message, onUndo) {
  els.toastMessage.textContent = message;
  els.toastUndo.hidden = typeof onUndo !== 'function';
  undoHandler = typeof onUndo === 'function' ? onUndo : null;

  els.toast.hidden = false;

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, TOAST_DURATION_MS);
}

/**
 * Hide the toast and forget the undo action.
 */
function hideToast() {
  window.clearTimeout(toastTimer);
  toastTimer = null;

  els.toast.hidden = true;
  undoHandler = null;
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

/**
 * Store a wake-up time as the current one.
 * @param {number} now epoch milliseconds
 */
function applyWakeUp(now) {
  const previousWakeMs = state.wakeMs;
  const previousZone = getSavedZone();

  state.wakeMs = now;
  setLastWakeMs(now);
  setSavedZone(currentZone());

  addHistoryEntry({
    wakeMs: now,
    bedtimeMs: predictBedtime(now, state.awakeMinutes),
    awakeMinutes: state.awakeMinutes,
  });

  render();
  startTimer();

  showToast(`Wake-up saved at ${formatTime(now)}`, () => {    if (previousWakeMs === null) {
      state.wakeMs = null;
      clearLastWakeMs();
    } else {
      state.wakeMs = previousWakeMs;
      setLastWakeMs(previousWakeMs);
    }

    removeHistoryEntry(now);

    if (previousZone === null) removeItem(KEYS.zone);
    else setSavedZone(previousZone);

    render();
  });
}

/**
 * Ask whether an existing wake-up time should be replaced.
 * @param {number} now epoch milliseconds
 * @returns {Promise<void>}
 */
async function confirmReplace(now) {
  const replace = await askConfirm({
    title: 'Replace your wake-up time?',
    text: `You already recorded a wake-up at ${formatTime(state.wakeMs)}. Replace it with the current time?`,
    acceptLabel: 'Replace',
    cancelLabel: 'Keep it',
  });

  if (replace) applyWakeUp(now);
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

els.toastUndo.addEventListener('click', () => {
  const undo = undoHandler;
  hideToast();
  if (undo) undo();
});

els.historyClear.addEventListener('click', async () => {
  const clear = await askConfirm({
    title: 'Clear the history?',
    text: 'This removes every recorded wake-up and bedtime. It cannot be undone.',
    acceptLabel: 'Clear',
    cancelLabel: 'Keep it',
  });

  if (!clear) return;

  clearHistory();
  renderHistory();
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

// The time zone can change while the app stays open, for example when the
// device travels or the user picks another zone.
window.addEventListener('focus', () => {
  render();
});

showView(routeFromHash());
updateStepper();
render();
startTimer();
handleLaunchAction();
registerServiceWorker();
