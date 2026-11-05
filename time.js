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
