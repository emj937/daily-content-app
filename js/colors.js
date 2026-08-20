// ============================================================
// Color is fully automatic — nobody picks it in admin. Weekdays
// and static sections rotate through blue/purple/pink; cycle days
// sweep the full hue wheel starting at red; Nighttime is a fixed
// dark magenta.
// ============================================================

export const TRIO = ["#5b6fe0", "#8b5fd9", "#d94f95"]; // blue, purple, pink
const WEEKDAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const NIGHTTIME_ACCENT = "#7a1350"; // dark magenta

export function weekdayAccent(key) {
  const i = WEEKDAY_ORDER.indexOf(key);
  return TRIO[i % TRIO.length];
}

/**
 * Alternate weekday color scheme: 7 evenly spaced hues around the wheel,
 * starting at red on Monday — same idea as the cycle sweep, just fixed
 * to a 7-day week instead of an arbitrary cycle length.
 */
export function weekdayRainbowAccent(key) {
  const i = WEEKDAY_ORDER.indexOf(key);
  const reversedIndex = 6 - i; // Monday <-> Sunday, Tuesday <-> Saturday, etc.
  const hue = Math.round((360 / 7) * reversedIndex);
  return `hsl(${hue} 72% 55%)`;
}

/**
 * Resolves a weekday-type section's accent based on its chosen color
 * scheme. "rainbow" opts into weekdayRainbowAccent; anything else
 * (including unset) uses the default blue/purple/pink trio.
 */
export function weekdaySectionAccent(key, colorScheme) {
  return colorScheme === "rainbow" ? weekdayRainbowAccent(key) : weekdayAccent(key);
}

/**
 * Cycle days sweep the hue wheel starting at red (hue 0) and wrap back
 * to red when the cycle repeats (index 0 and index `length` share a hue).
 */
export function cycleAccent(index, length) {
  const hue = Math.round((360 / length) * index);
  return `hsl(${hue} 72% 55%)`;
}

/**
 * Static (not day/cycle-linked) sections still get a stable identity
 * color from the same trio, derived from their id so it doesn't shift
 * if the section gets reordered.
 */
export function staticAccent(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return TRIO[hash % TRIO.length];
}

// Confetti palettes: same trio during the day, magenta shades at night.
export const CONFETTI_DAY_COLORS = TRIO;
export const CONFETTI_NIGHT_COLORS = ["#7a1350", "#9c1c68", "#5e0e3d", "#b12c7e"];

