/**
 * Pure time helpers for the Sleep Predictor.
 *
 * Nothing in this module touches the DOM, storage or the network, so every
 * function here can be unit tested directly (see `tests/`).
 *
 * Rules that matter for this app:
 *  - Instants are epoch milliseconds and are therefore timezone agnostic.
 *  - Formatting goes through `Intl`, so the device locale decides between a
 *    12-hour and a 24-hour clock and the device time zone is used.
 */

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Predict the bedtime for a given wake-up time.
 *
 * @param {number} wakeMs wake-up time in epoch milliseconds
 * @param {number} awakeMinutes how long the user plans to stay awake, in minutes
 * @returns {number} the predicted bedtime in epoch milliseconds
 */
export function predictBedtime(wakeMs, awakeMinutes) {
  const wake = Number(wakeMs);
  const minutes = Number(awakeMinutes);
  if (!Number.isFinite(wake) || !Number.isFinite(minutes)) return NaN;
  return wake + minutes * MINUTE_MS;
}

/**
 * Format an instant as a local clock time ("7:00 AM", "19:00").
 *
 * `Intl.DateTimeFormat` with an `undefined` locale follows the device locale,
 * which is what decides the 12/24 hour preference.
 *
 * @param {number} ms epoch milliseconds
 * @returns {string}
 */
export function formatTime(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(ms),
  );
}

/**
 * Format an instant as a short local date ("Nov 5").
 * @param {number} ms epoch milliseconds
 * @returns {string}
 */
export function formatDateShort(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ms));
}

/**
 * Format an instant as a local date and time ("Nov 5, 7:00 AM").
 * @param {number} ms epoch milliseconds
 * @returns {string}
 */
export function formatDateTime(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}
