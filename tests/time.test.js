import test from 'node:test';
import assert from 'node:assert/strict';

import {
  predictBedtime,
  formatTime,
  formatDateTime,
  formatDurationMinutes,
  formatCountdown,
  dayOffset,
  isSameLocalDay,
  formatDayOffsetLabel,
  currentZone,
  MINUTE_MS,
  HOUR_MS,
} from '../time.js';

/** Build a local-time instant (July 15th is never a DST transition date). */
const at = (year, month, day, hour, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0).getTime();

test('predictBedtime adds the awake duration', () => {
  const wake = at(2026, 7, 15, 7, 0);
  const bedtime = predictBedtime(wake, 16 * 60);

  assert.equal(bedtime - wake, 16 * HOUR_MS, 'elapsed time must match the awake duration');
  assert.equal(new Date(bedtime).getHours(), 23, '7:00 AM + 16h is 11:00 PM');
  assert.equal(new Date(bedtime).getMinutes(), 0);
});

test('predictBedtime supports arbitrary minute durations', () => {
  const wake = at(2026, 7, 15, 9, 30);
  const bedtime = predictBedtime(wake, 90);

  assert.equal(bedtime - wake, 90 * MINUTE_MS);
  assert.equal(new Date(bedtime).getHours(), 11);
  assert.equal(new Date(bedtime).getMinutes(), 0);
});

test('predictBedtime crosses midnight into the next day', () => {
  const wake = at(2026, 7, 15, 9, 0);
  const bedtime = predictBedtime(wake, 16 * 60);

  assert.equal(new Date(bedtime).getDate(), 16, 'the day must roll over');
  assert.equal(new Date(bedtime).getHours(), 1, '9:00 AM + 16h is 1:00 AM');
  assert.equal(dayOffset(wake, bedtime), 1, 'the bedtime is one local day later');
});

test('predictBedtime rejects invalid input', () => {
  assert.ok(Number.isNaN(predictBedtime(NaN, 960)));
  assert.ok(Number.isNaN(predictBedtime(Date.now(), 'abc')));
});

test('formatTime follows the device locale clock', () => {
  const ms = at(2026, 7, 15, 7, 0);
  const expected = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(ms),
  );

  assert.equal(formatTime(ms), expected);
  assert.equal(formatTime(at(2026, 7, 15, 19, 45)), new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(at(2026, 7, 15, 19, 45))));
  assert.equal(formatTime(NaN), '');
});

test('formatTime uses the local time zone', () => {
  const ms = at(2026, 7, 15, 13, 5);
  const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).formatToParts(
    new Date(ms),
  );
  const hour = parts.find((part) => part.type === 'hour').value;
  const minute = parts.find((part) => part.type === 'minute').value;

  // The hour part follows the locale clock: "1" in a 12-hour locale for 13:05.
  const options = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    .resolvedOptions();
  const uses12HourClock =
    options.hour12 ?? (options.hourCycle === 'h11' || options.hourCycle === 'h12');
  const localHour = new Date(ms).getHours();
  const expectedHour = uses12HourClock ? localHour % 12 || 12 : localHour;

  assert.equal(Number(hour), expectedHour);
  assert.equal(Number(minute), new Date(ms).getMinutes());
});

test('formatDateTime includes the date and the time', () => {
  const ms = at(2026, 7, 15, 7, 0);
  const output = formatDateTime(ms);

  assert.ok(output.length > 0);
  assert.ok(output.includes('7'), 'the hour should be part of the output');
});

test('formatDurationMinutes renders settings style durations', () => {
  assert.equal(formatDurationMinutes(960), '16h 00m');
  assert.equal(formatDurationMinutes(945), '15h 45m');
  assert.equal(formatDurationMinutes(60), '1h 00m');
  assert.equal(formatDurationMinutes(1440), '24h 00m');
  assert.equal(formatDurationMinutes(75), '1h 15m');
});

test('formatCountdown renders hours and minutes', () => {
  const result = formatCountdown(9 * HOUR_MS + 32 * MINUTE_MS);

  assert.deepEqual(result, { overdue: false, text: '9h 32m', totalMinutes: 572 });
});

test('formatCountdown drops empty parts', () => {
  assert.equal(formatCountdown(32 * MINUTE_MS).text, '32m');
  assert.equal(formatCountdown(60 * MINUTE_MS).text, '1h');
  assert.equal(formatCountdown(2 * HOUR_MS).text, '2h');
  assert.equal(formatCountdown(90 * 1000).text, '1m', 'partial minutes are not rounded up');
});

test('formatCountdown reports the overdue state', () => {
  const result = formatCountdown(-20 * MINUTE_MS);

  assert.equal(result.overdue, true);
  assert.equal(result.text, '20m');
  assert.equal(result.totalMinutes, 20);
});

test('formatCountdown handles the exact bedtime moment', () => {
  const result = formatCountdown(0);

  assert.equal(result.overdue, false, 'bedtime has not been missed yet');
  assert.equal(result.text, 'now');
});

test('formatCountdown handles invalid input', () => {
  assert.deepEqual(formatCountdown(NaN), { overdue: false, text: '', totalMinutes: 0 });
});

test('dayOffset compares local calendar days', () => {
  assert.equal(dayOffset(at(2026, 7, 15, 7, 0), at(2026, 7, 15, 23, 0)), 0);
  assert.equal(dayOffset(at(2026, 7, 15, 23, 0), at(2026, 7, 16, 1, 0)), 1);
  assert.equal(dayOffset(at(2026, 7, 16, 1, 0), at(2026, 7, 15, 23, 0)), -1);
  assert.equal(dayOffset(at(2026, 7, 15, 7, 0), at(2026, 7, 17, 7, 0)), 2);
});

test('dayOffset is not confused by a midnight crossing', () => {
  const wake = at(2026, 7, 15, 23, 30);
  const bedtime = at(2026, 7, 16, 15, 30);

  assert.equal(dayOffset(wake, bedtime), 1);
  assert.equal(isSameLocalDay(wake, bedtime), false);
  assert.equal(isSameLocalDay(wake, at(2026, 7, 15, 23, 45)), true);
});

test('formatDayOffsetLabel names the day', () => {
  assert.equal(formatDayOffsetLabel(0), 'today');
  assert.equal(formatDayOffsetLabel(1), 'tomorrow');
  assert.equal(formatDayOffsetLabel(-1), 'yesterday');
  assert.equal(formatDayOffsetLabel(3), 'in 3 days');
});

test('currentZone returns a time zone name', () => {
  const zone = currentZone();

  assert.equal(typeof zone, 'string');
  assert.ok(zone.length > 0);
});
