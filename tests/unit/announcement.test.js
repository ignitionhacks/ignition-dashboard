/**
 * Model-level tests for Announcement (design doc §1.2.2). No database
 * connection needed - `validate()` runs the validators entirely in memory.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { backendRequire, backendDependency } = require('../helpers/backend');

const mongoose = backendDependency('mongoose');
const Announcement = backendRequire('models/Announcement');

const AUTHOR_ID = new mongoose.Types.ObjectId();

const build = (overrides = {}) =>
  new Announcement({
    body: 'Lunch is served in the cafeteria.',
    authorId: AUTHOR_ID,
    authorName: 'Sally Organizer',
    ...overrides,
  });

describe('validation', () => {
  test('A.1  a valid announcement passes validation', async () => {
    const announcement = build({ title: 'Lunch' });
    await announcement.validate();

    assert.equal(announcement.title, 'Lunch');
    assert.equal(announcement.body, 'Lunch is served in the cafeteria.');
    assert.equal(announcement.authorName, 'Sally Organizer');
  });

  test('A.2  body is required', async () => {
    await assert.rejects(build({ body: undefined }).validate(), /body is required/);
  });

  test('A.3  a whitespace-only body is rejected (trimmed, then validated)', async () => {
    await assert.rejects(build({ body: '   ' }).validate(), /body/);
  });

  test('A.4  title is optional', async () => {
    const announcement = build();
    await announcement.validate();
    assert.equal(announcement.title, '');
  });

  test('A.5  a title over 200 characters is rejected', async () => {
    await assert.rejects(build({ title: 'x'.repeat(201) }).validate(), /title/);
  });

  test('A.6  authorId is required', async () => {
    await assert.rejects(build({ authorId: undefined }).validate(), /authorId is required/);
  });

  test('A.7  authorName is required', async () => {
    await assert.rejects(build({ authorName: undefined }).validate(), /authorName is required/);
  });
});

describe('defaults', () => {
  test('A.8  postedAt defaults to roughly now', async () => {
    const before = Date.now();
    const announcement = build();
    await announcement.validate();

    assert.ok(announcement.postedAt instanceof Date);
    assert.ok(announcement.postedAt.getTime() >= before - 1000);
    assert.ok(announcement.postedAt.getTime() <= Date.now() + 1000);
  });

  test('A.9  pinned defaults to false', async () => {
    const announcement = build();
    await announcement.validate();
    assert.equal(announcement.pinned, false);
  });

  test('A.9b an explicit postedAt is kept', async () => {
    const when = new Date('2026-08-14T09:00:00Z');
    const announcement = build({ postedAt: when });
    await announcement.validate();
    assert.equal(announcement.postedAt.getTime(), when.getTime());
  });
});

describe('persistence', () => {
  before(connect);
  after(disconnect);
  beforeEach(clear);

  test('A.10 timestamps are set on save', async () => {
    const announcement = await Announcement.create(build().toObject());

    assert.ok(announcement.createdAt instanceof Date);
    assert.ok(announcement.updatedAt instanceof Date);
  });

  test('A.11 updatedAt moves on a later save but createdAt does not', async () => {
    const announcement = await Announcement.create(build().toObject());
    const { createdAt, updatedAt } = announcement;

    await new Promise((resolve) => setTimeout(resolve, 10));
    announcement.body = 'Lunch is now in the atrium.';
    await announcement.save();

    assert.equal(announcement.createdAt.getTime(), createdAt.getTime());
    assert.ok(announcement.updatedAt.getTime() > updatedAt.getTime());
  });

  test('A.11b editing does not move postedAt (the feed keeps its order)', async () => {
    const announcement = await Announcement.create(build().toObject());
    const { postedAt } = announcement;

    announcement.body = 'Edited.';
    await announcement.save();

    assert.equal(announcement.postedAt.getTime(), postedAt.getTime());
  });

  test('A.12 validators re-run on update - a blank body is rejected', async () => {
    const announcement = await Announcement.create(build().toObject());

    announcement.body = '   ';
    await assert.rejects(announcement.save(), /body/);
  });

  test('A.13 toJSON drops __v', async () => {
    const announcement = await Announcement.create(build().toObject());
    const json = announcement.toJSON();

    assert.equal(json.__v, undefined);
    assert.ok(json._id);
  });
});
