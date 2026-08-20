// ============================================================
// Scheduling logic — pure functions, no Firebase dependency.
// Kept isolated so the date/time math can be reasoned about
// (and unit-tested) on its own.
// ============================================================

const WEEKDAY_KEYS = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

const NIGHTTIME_HOUR = 22; // 10 PM, in the viewer's local time

/**
 * Is it "nighttime" right now (10 PM or later, local time, any day)?
 * When true, the whole site collapses to just the Nighttime view.
 */
export function isNighttime(now = new Date()) {
  return now.getHours() >= NIGHTTIME_HOUR;
}

/** Which weekday key applies right now (only meaningful when NOT nighttime). */
export function currentWeekdayKey(now = new Date()) {
  return WEEKDAY_KEYS[now.getDay()];
}

export function weekdayLabel(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Which index (0-based) in a cycle's `days` array applies today,
 * given a fixed start date ("Day 1") and how many days are defined.
 * Uses local calendar dates only — time of day doesn't matter here.
 */
export function currentCycleIndex(startDateStr, cycleLength, now = new Date()) {
  if (!startDateStr || !cycleLength) return null;

  const start = localMidnight(parseDateOnly(startDateStr));
  const today = localMidnight(now);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((today - start) / msPerDay);

  // Wrap into [0, cycleLength) even for dates before the start date.
  const index = ((diffDays % cycleLength) + cycleLength) % cycleLength;
  return index;
}

function parseDateOnly(str) {
  // str is "YYYY-MM-DD" — construct as local, not UTC.
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "YYYY-MM-DD" for the visitor's local date — used as the history doc id. */
export function dateKey(now = new Date()) {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export { WEEKDAY_KEYS, NIGHTTIME_HOUR };

