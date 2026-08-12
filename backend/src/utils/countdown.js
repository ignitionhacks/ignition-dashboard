/**
 * Countdown formatting (design doc §1.2.3: the countdown is "formatted HH:MM:SS
 * server-side or returned as a raw timestamp"). We return both.
 *
 * Kept as a pure function so it can be unit-tested without a clock or a
 * database - every rule below is one test in `tests/unit/countdown.test.js`.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const pad = (n) => String(n).padStart(2, '0');

/**
 * Format a millisecond duration as `HH:MM:SS`.
 *
 * Two deliberate rules:
 * - **Hours do not wrap at 24.** A 48-hour hackathon shows `47:59:59`, not
 *   `23:59:59`. Hours are padded to *at least* two digits, so 100h is `100:00:00`.
 * - **Never negative.** Anything at or below zero - and anything that isn't a
 *   finite number - is `00:00:00`. A countdown that runs backwards past the end
 *   is worse than one that sits at zero.
 *
 * Sub-second remainders round down: 1999ms is "1 second left", not 2.
 */
function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Build the countdown block for a config document.
 *
 * `now` is injectable so callers (and tests) aren't at the mercy of the wall
 * clock. `msRemaining` clamps at 0 for the same reason `formatCountdown` does.
 */
function buildCountdown({ startAt, endAt, now = new Date() }) {
  const nowMs = now.getTime();
  const endMs = endAt.getTime();
  const msRemaining = Math.max(0, endMs - nowMs);

  return {
    endsAt: endAt,
    msRemaining,
    formatted: formatCountdown(msRemaining),
    hasStarted: nowMs >= startAt.getTime(),
    hasEnded: nowMs >= endMs,
  };
}

module.exports = { formatCountdown, buildCountdown, SECOND, MINUTE, HOUR };
