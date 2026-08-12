/**
 * Model-level tests for Project Submission (design doc §1.2.4, §4).
 *
 * This file opens a database because the rule that matters most - §4's "only one
 * submission exists per team" - is a unique *index*, and an in-memory
 * `validate()` cannot see indexes.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { backendRequire, backendDependency } = require('../helpers/backend');

const mongoose = backendDependency('mongoose');
const Submission = backendRequire('models/Submission');
const { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } = Submission;

const teamId = () => new mongoose.Types.ObjectId();

/** A valid payload; override any field per test. */
const payload = (overrides = {}) => ({
  teamId: teamId(),
  title: 'Ignition Dashboard',
  description: 'A dashboard for hackers.',
  ...overrides,
});

before(async () => {
  await connect();
  await Submission.syncIndexes();
});
after(disconnect);
beforeEach(clear);

describe('required fields', () => {
  test('SU.1  teamId is required - a submission with no team is meaningless', async () => {
    const submission = new Submission(payload({ teamId: undefined }));
    await assert.rejects(submission.validate(), /teamId is required/);
  });

  test('SU.2  title is required', async () => {
    await assert.rejects(new Submission(payload({ title: undefined })).validate(), /title is required/);
  });

  test('SU.2b a blank title is rejected', async () => {
    await assert.rejects(new Submission(payload({ title: '   ' })).validate(), /title/);
  });

  test('SU.3  description is required', async () => {
    await assert.rejects(
      new Submission(payload({ description: undefined })).validate(),
      /description is required/
    );
  });

  test('SU.4  a title over the limit is rejected', async () => {
    const submission = new Submission(payload({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) }));
    await assert.rejects(submission.validate(), /title/);
  });

  test('SU.4b a description over the limit is rejected', async () => {
    const submission = new Submission(
      payload({ description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1) })
    );
    await assert.rejects(submission.validate(), /description/);
  });
});

describe('one submission per team (§4)', () => {
  test('SU.5  a second submission for the same team is a duplicate key error', async () => {
    const team = teamId();
    await Submission.create(payload({ teamId: team }));

    await assert.rejects(
      Submission.create(payload({ teamId: team, title: 'Second attempt' })),
      (err) => err.code === 11000
    );
  });

  test('SU.5b a different team may submit', async () => {
    await Submission.create(payload());
    await Submission.create(payload());

    assert.equal(await Submission.countDocuments(), 2);
  });
});

describe('URLs', () => {
  /**
   * Deliberately permissive: hackers paste GitHub, GitLab, Devpost and the odd
   * Google Drive link. Rejecting a valid submission at 11:58pm because of an
   * over-tight regex is a far worse failure than accepting an odd URL.
   */
  test('SU.6  devpostUrl and repoUrl are optional', async () => {
    const submission = await Submission.create(payload());

    assert.equal(submission.devpostUrl, null);
    assert.equal(submission.repoUrl, null);
  });

  test('SU.7  a devpostUrl that is not a URL is rejected', async () => {
    await assert.rejects(
      new Submission(payload({ devpostUrl: 'devpost.com/my-project' })).validate(),
      /devpostUrl/
    );
  });

  test('SU.7b a repoUrl that is not a URL is rejected', async () => {
    await assert.rejects(
      new Submission(payload({ repoUrl: 'not a url at all' })).validate(),
      /repoUrl/
    );
  });

  test('SU.8  http:// and https:// are both accepted', async () => {
    const submission = await Submission.create(
      payload({
        devpostUrl: 'https://devpost.com/software/ignition',
        repoUrl: 'http://github.com/abdullah/ignition',
      })
    );

    assert.equal(submission.devpostUrl, 'https://devpost.com/software/ignition');
    assert.equal(submission.repoUrl, 'http://github.com/abdullah/ignition');
  });
});

describe('timestamps and audit', () => {
  test('SU.9  submittedAt defaults to now', async () => {
    const before = Date.now();
    const submission = await Submission.create(payload());

    assert.ok(submission.submittedAt instanceof Date);
    assert.ok(submission.submittedAt.getTime() >= before);
    assert.ok(submission.submittedAt.getTime() <= Date.now());
  });

  test('SU.10 submittedAt survives a later edit - it is when the team submitted', async () => {
    const submission = await Submission.create(payload());
    const originalSubmittedAt = submission.submittedAt.getTime();

    submission.submittedAt = new Date('2000-01-01T00:00:00Z');
    submission.title = 'Renamed';
    await submission.save();

    const reloaded = await Submission.findById(submission._id);
    assert.equal(reloaded.submittedAt.getTime(), originalSubmittedAt);
    assert.equal(reloaded.title, 'Renamed');
  });

  test('SU.10b updatedAt moves when the submission is edited', async () => {
    const submission = await Submission.create(payload());
    const first = submission.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 10));
    submission.title = 'Renamed';
    await submission.save();

    assert.ok(submission.updatedAt.getTime() > first);
  });

  test('SU.11 submittedBy is optional but kept when given', async () => {
    const author = new mongoose.Types.ObjectId();
    const submission = await Submission.create(payload({ submittedBy: author }));

    assert.equal(submission.submittedBy.toString(), author.toString());
    assert.equal((await Submission.create(payload())).submittedBy, null);
  });
});

describe('serialization and updates', () => {
  test('SU.12 validators re-run on a findByIdAndUpdate with runValidators', async () => {
    const submission = await Submission.create(payload());

    await assert.rejects(
      Submission.findByIdAndUpdate(submission._id, { title: '' }, { runValidators: true }),
      /title/
    );
  });

  test('SU.12b toJSON drops __v', async () => {
    const submission = await Submission.create(payload());
    const json = submission.toJSON();

    assert.equal(json.__v, undefined);
    assert.ok(json._id);
  });
});
