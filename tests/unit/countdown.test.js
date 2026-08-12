/**
 * The countdown formatter (design doc §1.2.3: the countdown is "formatted
 * HH:MM:SS server-side or returned as a raw timestamp").
 *
 * Pure function, no database and no clock - every case here is a fixed number
 * of milliseconds in and a fixed string out.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { backendRequire } = require('../helpers/backend');

const { formatCountdown } = backendRequire('utils/countdown');

describe('formatCountdown', () => {
  test('C.1  zero is 00:00:00', () => {
    assert.equal(formatCountdown(0), '00:00:00');
  });

  test('C.2  one second', () => {
    assert.equal(formatCountdown(1000), '00:00:01');
  });

  test('C.3  a minute and a second', () => {
    assert.equal(formatCountdown(61_000), '00:01:01');
  });

  test('C.4  exactly one hour', () => {
    assert.equal(formatCountdown(3_600_000), '01:00:00');
  });

  test('C.5  hours do NOT wrap at 24 - a 48h hackathon must show 47:59:59', () => {
    assert.equal(formatCountdown(172_799_000), '47:59:59');
  });

  test('C.6  exactly 24 hours is 24:00:00, not 00:00:00', () => {
    assert.equal(formatCountdown(86_400_000), '24:00:00');
  });

  test('C.7  a negative value clamps to 00:00:00 - the countdown never runs backwards', () => {
    assert.equal(formatCountdown(-1), '00:00:00');
    assert.equal(formatCountdown(-500_000), '00:00:00');
  });

  test('C.8  sub-second remainders round down', () => {
    // 1999ms is still "1 second left", not 2.
    assert.equal(formatCountdown(1999), '00:00:01');
    assert.equal(formatCountdown(999), '00:00:00');
  });

  test('C.9  three-digit hours still pad correctly', () => {
    // 100 hours - the format is at *least* two digits, not exactly two.
    assert.equal(formatCountdown(360_000_000), '100:00:00');
  });

  test('C.10 a non-number is treated as no time remaining, never NaN:NaN:NaN', () => {
    assert.equal(formatCountdown(undefined), '00:00:00');
    assert.equal(formatCountdown(null), '00:00:00');
    assert.equal(formatCountdown(Number.NaN), '00:00:00');
  });
});
