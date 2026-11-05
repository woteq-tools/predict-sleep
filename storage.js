/**
 * Storage helpers for the Sleep Predictor.
 *
 * All data stays on the device - there is no backend and no account.
 *
 *  - Timestamps are stored as epoch milliseconds (absolute, timezone agnostic).
 *  - Durations are stored as an integer number of minutes.
 *
 * Every access is guarded: `localStorage` throws in private browsing modes and
 * when the user blocks storage, so we transparently fall back to an in-memory
 * store that keeps the app usable for the current session.
 */

const NAMESPACE = 'sleep';

/** Keys used in localStorage. */
export const KEYS = Object.freeze({
  awakeMinutes: `${NAMESPACE}.awakeMinutes`,
  lastWakeMs: `${NAMESPACE}.lastWakeMs`,
  history: `${NAMESPACE}.history`,
  zone: `${NAMESPACE}.zone`,
  notifyEnabled: `${NAMESPACE}.notifyEnabled`,
  notifyLeadMinutes: `${NAMESPACE}.notifyLeadMinutes`,
});

/** Defaults and limits. */
export const DEFAULTS = Object.freeze({
  awakeMinutes: 960, // 16 hours
  minAwakeMinutes: 60, // 1 hour
  maxAwakeMinutes: 1440, // 24 hours
  stepMinutes: 15,
  historyLimit: 60,
  notifyLeadMinutes: 30, // notify 30 minutes before bedtime
});

/** Fallback store used when localStorage is unavailable. */
const memoryStore = new Map();

/** Cached result of the localStorage availability probe. */
let persistent = null;

/**
 * Check whether localStorage can actually be used.
 * @returns {boolean}
 */
function isPersistent() {
  if (persistent !== null) return persistent;
  try {
    const store = globalThis.localStorage;
    if (!store) {
      persistent = false;
      return persistent;
    }
    const probe = `${NAMESPACE}.__probe__`;
    store.setItem(probe, '1');
    store.removeItem(probe);
    persistent = true;
  } catch {
    persistent = false;
  }
  return persistent;
}

/**
 * Forget the cached availability probe.
 * Only useful for tests, which swap the storage implementation.
 */
export function resetStorageCache() {
  persistent = null;
}

/**
 * Read a raw string value.
 * @param {string} key
 * @returns {string|null}
 */
function readRaw(key) {
  if (!isPersistent()) {
    return memoryStore.has(key) ? memoryStore.get(key) : null;
  }
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write a raw string value.
 * @param {string} key
 * @param {string} value
 * @returns {boolean} true when the value was persisted
 */
function writeRaw(key, value) {
  if (!isPersistent()) {
    memoryStore.set(key, value);
    return false;
  }
  try {
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded or storage turned off mid-session: keep working in RAM.
    memoryStore.set(key, value);
    return false;
  }
}

/**
 * Remove a raw value.
 * @param {string} key
 */
function removeRaw(key) {
  memoryStore.delete(key);
  if (!isPersistent()) return;
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Read and JSON-decode a value.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function getItem(key, fallback = null) {
  const raw = readRaw(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/**
 * JSON-encode and store a value.
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} true when the value was persisted
 */
export function setItem(key, value) {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/**
 * Remove a stored value.
 * @param {string} key
 */
export function removeItem(key) {
  removeRaw(key);
}

/**
 * True when values survive a page reload (false in private mode / fallback).
 * @returns {boolean}
 */
export function isPersistentStorage() {
  return isPersistent();
}

/* ------------------------------------------------------------------ *
 * Awake duration
 * ------------------------------------------------------------------ */

/**
 * Clamp an awake duration into the allowed range.
 * @param {number} minutes
 * @returns {number}
 */
export function clampAwakeMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return DEFAULTS.awakeMinutes;
  return Math.min(DEFAULTS.maxAwakeMinutes, Math.max(DEFAULTS.minAwakeMinutes, Math.round(value)));
}

/**
 * Snap an awake duration to the nearest step (15 minutes by default).
 * @param {number} minutes
 * @param {number} [step]
 * @returns {number}
 */
export function roundToStep(minutes, step = DEFAULTS.stepMinutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return DEFAULTS.awakeMinutes;
  const snapped = Math.round(value / step) * step;
  return clampAwakeMinutes(snapped);
}

/**
 * The configured awake duration in minutes.
 * @returns {number}
 */
export function getAwakeMinutes() {
  const stored = getItem(KEYS.awakeMinutes, DEFAULTS.awakeMinutes);
  return clampAwakeMinutes(stored);
}

/**
 * Store the awake duration.
 * @param {number} minutes
 * @returns {number} the stored (clamped) value
 */
export function setAwakeMinutes(minutes) {
  const value = roundToStep(minutes);
  setItem(KEYS.awakeMinutes, value);
  return value;
}

/* ------------------------------------------------------------------ *
 * Last wake-up
 * ------------------------------------------------------------------ */

/**
 * The last recorded wake-up time in epoch milliseconds.
 * @returns {number|null}
 */
export function getLastWakeMs() {
  const stored = getItem(KEYS.lastWakeMs, null);
  return typeof stored === 'number' && Number.isFinite(stored) ? stored : null;
}

/**
 * Store the last wake-up time.
 * @param {number} ms epoch milliseconds
 */
export function setLastWakeMs(ms) {
  setItem(KEYS.lastWakeMs, ms);
}

/**
 * Forget the last wake-up time.
 */
export function clearLastWakeMs() {
  removeItem(KEYS.lastWakeMs);
}

/**
 * The time zone that was active when the last wake-up was recorded.
 * @returns {string|null} an IANA time zone id, e.g. "Europe/Berlin"
 */
export function getSavedZone() {
  const stored = getItem(KEYS.zone, null);
  return typeof stored === 'string' ? stored : null;
}

/**
 * Store the current time zone.
 * @param {string} zone
 */
export function setSavedZone(zone) {
  setItem(KEYS.zone, zone);
}

/* ------------------------------------------------------------------ *
 * History
 * ------------------------------------------------------------------ */

/**
 * The wake-up history, newest first.
 * @returns {Array<{wakeMs:number,bedtimeMs:number,awakeMinutes:number}>}
 */
export function getHistory() {
  const stored = getItem(KEYS.history, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      typeof entry.wakeMs === 'number' &&
      typeof entry.bedtimeMs === 'number',
  );
}

/**
 * Add an entry to the history, keeping the newest first and capping the size.
 * @param {{wakeMs:number,bedtimeMs:number,awakeMinutes:number}} entry
 * @returns {Array} the updated history
 */
export function addHistoryEntry(entry) {
  const history = getHistory();
  history.unshift(entry);
  const capped = history.slice(0, DEFAULTS.historyLimit);
  setItem(KEYS.history, capped);
  return capped;
}

/**
 * Remove the newest entry for a given wake-up time.
 * Used when a wake-up is undone.
 *
 * @param {number} wakeMs
 * @returns {Array} the updated history
 */
export function removeHistoryEntry(wakeMs) {
  const history = getHistory();
  const index = history.findIndex((entry) => entry.wakeMs === wakeMs);
  if (index === -1) return history;

  history.splice(index, 1);
  setItem(KEYS.history, history);
  return history;
}

/**
 * Remove every history entry.
 */
export function clearHistory() {
  removeItem(KEYS.history);
}

/* ------------------------------------------------------------------ *
 * Reminder notifications
 * ------------------------------------------------------------------ */

/**
 * Whether the user asked for a bedtime reminder.
 * @returns {boolean}
 */
export function getNotifyEnabled() {
  return getItem(KEYS.notifyEnabled, false) === true;
}

/**
 * Toggle the bedtime reminder.
 * @param {boolean} enabled
 */
export function setNotifyEnabled(enabled) {
  setItem(KEYS.notifyEnabled, enabled === true);
}

/**
 * How long before bedtime the reminder fires, in minutes.
 * @returns {number}
 */
export function getNotifyLeadMinutes() {
  const stored = getItem(KEYS.notifyLeadMinutes, DEFAULTS.notifyLeadMinutes);
  const value = Number(stored);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULTS.notifyLeadMinutes;
}

/**
 * Set how long before bedtime the reminder fires.
 * @param {number} minutes
 */
export function setNotifyLeadMinutes(minutes) {
  const value = Number(minutes);
  setItem(
    KEYS.notifyLeadMinutes,
    Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULTS.notifyLeadMinutes,
  );
}
