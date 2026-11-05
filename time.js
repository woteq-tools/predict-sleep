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
 *  - "Which calendar day?" is answered with *local* calendar parts, not with
 *    a fixed 24 hour offset, so daylight saving changes cannot mislabel a
 *    bedtime as being on the next day.
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

/**
 * Format a duration in minutes as "16h 00m".
 * Used by the settings screen, where the minutes part is always shown.
 *
 * @param {number} minutes
 * @returns {string}
 */
export function formatDurationMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

/**
 * Format a remaining/overdue duration as a countdown string.
 *
 * @param {number} ms milliseconds until the target (negative when overdue)
 * @returns {{overdue: boolean, text: string, totalMinutes: number}}
 */
export function formatCountdown(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return { overdue: false, text: '', totalMinutes: 0 };

  const overdue = value < 0;
  const abs = Math.abs(value);
  const totalMinutes = Math.floor(abs / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let text;
  if (totalMinutes === 0) {
    text = 'now';
  } else if (hours === 0) {
    text = `${minutes}m`;
  } else if (minutes === 0) {
    text = `${hours}h`;
  } else {
    text = `${hours}h ${minutes}m`;
  }

  return { overdue, text, totalMinutes };
}

/**
 * The local calendar day index of an instant.
 *
 * Using the local calendar parts (instead of `Math.floor(ms / DAY_MS)`) keeps
 * the answer correct across daylight saving changes, where the UTC day and the
 * local day start at different moments.
 *
 * @param {number} ms epoch milliseconds
 * @returns {number} a comparable day index
 */
function localDayIndex(ms) {
  const date = new Date(ms);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * How many calendar days apart two instants are in the local time zone.
 *
 * @param {number} fromMs
 * @param {number} toMs
 * @returns {number} negative when `toMs` is on an earlier local day
 */
export function dayOffset(fromMs, toMs) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  const from = localDayIndex(fromMs);
  const to = localDayIndex(toMs);
  return Math.round((to - from) / DAY_MS);
}

/**
 * Whether two instants fall on the same local calendar day.
 * @param {number} a
 * @param {number} b
 * @returns {boolean}
 */
export function isSameLocalDay(a, b) {
  return dayOffset(a, b) === 0;
}

/**
 * A human label for a day offset ("today", "tomorrow", "yesterday").
 * @param {number} offset
 * @returns {string}
 */
export function formatDayOffsetLabel(offset) {
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  if (offset === -1) return 'yesterday';
  if (offset > 1) return `in ${offset} days`;
  return `${Math.abs(offset)} days ago`;
}

/**
 * The current IANA time zone of the device.
 * @returns {string} e.g. "Europe/Berlin"
 */
export function currentZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    return 'unknown';
  }
}
