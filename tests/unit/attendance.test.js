/**
 * Model-level tests for Attendance (design doc §3.2.2).
 *
 * Like the QRCode tests, this file opens a real in-memory database: the rule
 * "one attendance record per user per event" is a unique compound *index*, and
 * an in-memory `validate()` cannot see indexes at all.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect, mongoose } = require('../helpers/db');
const { backendRequire } = require('../helpers/backend');

const Attendance = backendRequire('models/Attendance');

const oid = () => new mongoose.Types.ObjectId();

before(async () => {
  await connect();
  await Attendance.syncIndexes();
});
after(disconnect);
beforeEach(clear);

const build = (overrides = {}) =>
  new Attendance({ userId: oid(), scheduleEventId: oid(), ...overrides });

describe('validation', () => {
  test('requires a userId', async () => {
    await assert.rejects(() => new Attendance({ scheduleEventId: oid() }).validate());
  });

  test('requires a scheduleEventId', async () => {
    await assert.rejects(() => new Attendance({ userId: oid() }).validate());
  });

  test('accepts a userId + scheduleEventId pair', async () => {
    await build().validate();
  });
});

describe('defaults', () => {
  test('a new record is not checked in', () => {
    assert.equal(build().checkedIn, false);
  });

  test('checkedInAt is null until scanned (§3.2.2)', () => {
    assert.equal(build().checkedInAt, null);
  });

  test('checkedInBy is null until scanned', () => {
    assert.equal(build().checkedInBy, null);
  });
});

describe('checkedInAt stamping', () => {
  test('is stamped automatically when checkedIn becomes true', async () => {
    const record = build({ checkedIn: true });
    await record.validate();
    assert.ok(record.checkedInAt instanceof Date);
  });

  test('stays null while checkedIn is false', async () => {
    const record = build({ checkedIn: false });
    await record.validate();
    assert.equal(record.checkedInAt, null);
  });

  test('an existing timestamp is never overwritten - the FIRST scan wins', async () => {
    const firstScan = new Date('2026-08-14T11:30:00Z');
    const record = build({ checkedIn: true, checkedInAt: firstScan });

    await record.validate();
    await record.validate(); // a re-scan revalidates the same document

    assert.equal(record.checkedInAt.toISOString(), firstScan.toISOString());
  });
});

describe('uniqueness - one record per user per event', () => {
  test('the same user cannot be recorded twice for one event', async () => {
    const userId = oid();
    const scheduleEventId = oid();
    await Attendance.create({ userId, scheduleEventId });

    await assert.rejects(
      () => Attendance.create({ userId, scheduleEventId }),
      (err) => err.code === 11000
    );
  });

  test('one user across different events is fine', async () => {
    const userId = oid();
    await Attendance.create({ userId, scheduleEventId: oid() });
    await Attendance.create({ userId, scheduleEventId: oid() });

    assert.equal(await Attendance.countDocuments({ userId }), 2);
  });

  test('different users at the same event is fine', async () => {
    const scheduleEventId = oid();
    await Attendance.create({ userId: oid(), scheduleEventId });
    await Attendance.create({ userId: oid(), scheduleEventId });

    assert.equal(await Attendance.countDocuments({ scheduleEventId }), 2);
  });
});

describe('recordCheckIn - the one path both scan and manual entry use', () => {
  test('creates a checked-in record when none exists', async () => {
    const userId = oid();
    const scheduleEventId = oid();
    const by = oid();

    const { attendance, created } = await Attendance.recordCheckIn({
      userId,
      scheduleEventId,
      checkedInBy: by,
    });

    assert.equal(created, true);
    assert.equal(attendance.checkedIn, true);
    assert.ok(attendance.checkedInAt instanceof Date);
    assert.equal(attendance.checkedInBy.toString(), by.toString());
  });

  test('a second call reports created:false and does not duplicate', async () => {
    const userId = oid();
    const scheduleEventId = oid();

    await Attendance.recordCheckIn({ userId, scheduleEventId, checkedInBy: oid() });
    const { created } = await Attendance.recordCheckIn({
      userId,
      scheduleEventId,
      checkedInBy: oid(),
    });

    assert.equal(created, false);
    assert.equal(await Attendance.countDocuments(), 1);
  });

  test('a re-scan keeps the original timestamp and original scanner', async () => {
    const userId = oid();
    const scheduleEventId = oid();
    const firstScanner = oid();

    const first = await Attendance.recordCheckIn({
      userId,
      scheduleEventId,
      checkedInBy: firstScanner,
    });
    const originalAt = first.attendance.checkedInAt.toISOString();

    const second = await Attendance.recordCheckIn({
      userId,
      scheduleEventId,
      checkedInBy: oid(),
    });

    assert.equal(second.attendance.checkedInAt.toISOString(), originalAt);
    assert.equal(second.attendance.checkedInBy.toString(), firstScanner.toString());
  });

  test('flips an existing un-checked placeholder to checked in', async () => {
    const userId = oid();
    const scheduleEventId = oid();
    await Attendance.create({ userId, scheduleEventId }); // checkedIn: false

    const { attendance, created } = await Attendance.recordCheckIn({
      userId,
      scheduleEventId,
      checkedInBy: oid(),
    });

    assert.equal(created, false);
    assert.equal(attendance.checkedIn, true);
    assert.ok(attendance.checkedInAt instanceof Date);
  });
});

describe('serialization', () => {
  test('drops the internal version key', () => {
    assert.equal(build().toJSON().__v, undefined);
  });
});
