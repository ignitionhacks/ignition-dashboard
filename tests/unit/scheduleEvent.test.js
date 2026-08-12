/**
 * Model-level tests for ScheduleEvent. No database connection needed -
 * `validate()` runs the hooks and validators entirely in memory.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { backendRequire } = require('../helpers/backend');

const ScheduleEvent = backendRequire('models/ScheduleEvent');
const { CATEGORIES, toDayString } = ScheduleEvent;

const build = (overrides = {}) =>
  new ScheduleEvent({
    title: 'Opening Ceremony',
    startTime: new Date('2026-08-14T09:00:00Z'),
    location: 'Main Auditorium',
    category: 'Main',
    ...overrides,
  });

describe('toDayString', () => {
  test('formats a date as YYYY-MM-DD in UTC', () => {
    assert.equal(toDayString(new Date('2026-08-14T09:00:00Z')), '2026-08-14');
  });

  test('uses UTC, not local time - a late-UTC time stays on its UTC day', () => {
    assert.equal(toDayString(new Date('2026-08-14T23:59:00Z')), '2026-08-14');
  });
});

describe('derived fields', () => {
  test('day comes from startTime', async () => {
    const event = build();
    await event.validate();
    assert.equal(event.day, '2026-08-14');
  });

  test('isFoodEvent is true only for the Food category', async () => {
    const food = build({ category: 'Food' });
    const main = build({ category: 'Main' });
    await food.validate();
    await main.validate();

    assert.equal(food.isFoodEvent, true);
    assert.equal(main.isFoodEvent, false);
  });

  test('day is re-derived when startTime changes', async () => {
    const event = build();
    await event.validate();
    event.startTime = new Date('2026-08-15T09:00:00Z');
    await event.validate();

    assert.equal(event.day, '2026-08-15');
  });
});

describe('validation', () => {
  test('accepts every documented category', async () => {
    assert.deepEqual(CATEGORIES, ['Main', 'Fun', 'Food', 'Workshop']);
    for (const category of CATEGORIES) {
      await build({ category }).validate();
    }
  });

  test('rejects a blank title', async () => {
    await assert.rejects(() => build({ title: '   ' }).validate());
  });

  test('rejects a blank location', async () => {
    await assert.rejects(() => build({ location: '   ' }).validate());
  });

  test('rejects a missing startTime', async () => {
    await assert.rejects(() => build({ startTime: undefined }).validate());
  });

  test('rejects an unknown category', async () => {
    await assert.rejects(() => build({ category: 'Networking' }).validate());
  });

  test('allows a null endTime', async () => {
    await build({ endTime: null }).validate();
  });

  test('rejects an endTime equal to startTime', async () => {
    await assert.rejects(() =>
      build({ endTime: new Date('2026-08-14T09:00:00Z') }).validate()
    );
  });

  test('rejects an endTime before startTime', async () => {
    await assert.rejects(() =>
      build({ endTime: new Date('2026-08-14T08:00:00Z') }).validate()
    );
  });

  test('accepts an endTime after startTime', async () => {
    await build({ endTime: new Date('2026-08-14T10:00:00Z') }).validate();
  });
});

describe('serialization', () => {
  test('drops the internal version key', () => {
    const json = build().toJSON();
    assert.equal(json.__v, undefined);
  });
});
