/**
 * Model-level tests for HackathonConfig (design doc §1.2.3, §4: "a singleton,
 * referenced implicitly by everything time based").
 *
 * This file opens a database: the singleton guarantee is a unique *index*, and
 * an in-memory `validate()` cannot see indexes at all.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { backendRequire } = require('../helpers/backend');

const HackathonConfig = backendRequire('models/HackathonConfig');

const START = new Date('2026-08-14T13:00:00Z');
const END = new Date('2026-08-16T13:00:00Z');

const build = (overrides = {}) =>
  new HackathonConfig({ hackathonStartAt: START, hackathonEndAt: END, ...overrides });

before(async () => {
  await connect();
  // The singleton is enforced by a unique index, which mongoose builds lazily -
  // H.5 is meaningless until it exists.
  await HackathonConfig.syncIndexes();
});
after(disconnect);
beforeEach(clear);

describe('validation', () => {
  test('H.1  a valid config passes validation', async () => {
    const config = build();
    await config.validate();

    assert.equal(config.hackathonStartAt.getTime(), START.getTime());
    assert.equal(config.hackathonEndAt.getTime(), END.getTime());
  });

  test('H.2  hackathonStartAt is required', async () => {
    await assert.rejects(
      build({ hackathonStartAt: undefined }).validate(),
      /hackathonStartAt is required/
    );
  });

  test('H.3  hackathonEndAt is required', async () => {
    await assert.rejects(
      build({ hackathonEndAt: undefined }).validate(),
      /hackathonEndAt is required/
    );
  });

  test('H.4  hackathonEndAt must be after hackathonStartAt', async () => {
    await assert.rejects(
      build({ hackathonEndAt: new Date('2026-08-13T13:00:00Z') }).validate(),
      /hackathonEndAt must be after hackathonStartAt/
    );
  });

  test('H.4b an end equal to the start is rejected - a zero-length hackathon is not a thing', async () => {
    await assert.rejects(build({ hackathonEndAt: START }).validate(), /hackathonEndAt/);
  });

  test('H.4c submissionDeadline is optional and defaults to null', async () => {
    const config = build();
    await config.validate();
    assert.equal(config.submissionDeadline, null);
  });

  test('H.4d an explicit submissionDeadline is kept', async () => {
    const deadline = new Date('2026-08-16T11:00:00Z');
    const config = build({ submissionDeadline: deadline });
    await config.validate();
    assert.equal(config.submissionDeadline.getTime(), deadline.getTime());
  });
});

describe('the singleton', () => {
  test('H.5  a second document is rejected by the database, not by convention', async () => {
    await HackathonConfig.create(build().toObject());

    await assert.rejects(
      HackathonConfig.create({ hackathonStartAt: START, hackathonEndAt: END }),
      (err) => err.code === 11000
    );

    assert.equal(await HackathonConfig.countDocuments(), 1);
  });

  test('H.5b the singleton discriminator cannot be set to anything else', async () => {
    await assert.rejects(build({ singleton: 'other' }).validate(), /singleton/);
  });

  test('H.6  getSingleton() returns null when nothing is configured', async () => {
    assert.equal(await HackathonConfig.getSingleton(), null);
  });

  test('H.7  getSingleton() returns the one document', async () => {
    const saved = await HackathonConfig.create(build().toObject());
    const found = await HackathonConfig.getSingleton();

    assert.ok(found);
    assert.equal(found._id.toString(), saved._id.toString());
    assert.equal(found.hackathonEndAt.getTime(), END.getTime());
  });
});

describe('persistence', () => {
  test('H.8  timestamps are set on save', async () => {
    const config = await HackathonConfig.create(build().toObject());

    assert.ok(config.createdAt instanceof Date);
    assert.ok(config.updatedAt instanceof Date);
  });

  test('H.9  validators re-run on update - end before start is still rejected', async () => {
    const config = await HackathonConfig.create(build().toObject());

    config.hackathonEndAt = new Date('2026-08-13T13:00:00Z');
    await assert.rejects(config.save(), /hackathonEndAt/);
  });

  test('H.10 toJSON drops __v and the internal singleton key', async () => {
    const config = await HackathonConfig.create(build().toObject());
    const json = config.toJSON();

    assert.equal(json.__v, undefined);
    assert.equal(json.singleton, undefined);
    assert.ok(json._id);
  });
});
