/**
 * Model-level tests for Team (design doc §7's assumption, §4, §1.2.1's `User.teamId`).
 *
 * This file opens a database: the "one team per name" rule is a unique *index*
 * with a case-insensitive collation, and an in-memory `validate()` can see
 * neither indexes nor collations.
 *
 * There are no integration tests for Team anywhere in the suite, and that is
 * deliberate - §5's router list has no `teamRouter`, so Team has no HTTP
 * surface at all. Every invariant lives in the model and the service.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { backendRequire, backendDependency } = require('../helpers/backend');

const mongoose = backendDependency('mongoose');
const Team = backendRequire('models/Team');
const { MAX_TEAM_SIZE } = Team;

const userId = () => new mongoose.Types.ObjectId();

before(async () => {
  await connect();
  await Team.syncIndexes();
});
after(disconnect);
beforeEach(clear);

describe('validation', () => {
  test('T.1  a team needs only a name, and starts with no members', async () => {
    const team = new Team({ name: 'Team Rocket' });
    await team.validate();

    assert.equal(team.name, 'Team Rocket');
    assert.deepEqual(team.memberIds, []);
    assert.equal(team.createdBy, null);
  });

  test('T.2  name is required', async () => {
    await assert.rejects(new Team({}).validate(), /name is required/);
  });

  test('T.3  a whitespace-only name is rejected', async () => {
    await assert.rejects(new Team({ name: '   ' }).validate(), /name/);
  });

  test('T.4  MAX_TEAM_SIZE is 4 and a fifth member is rejected', async () => {
    assert.equal(MAX_TEAM_SIZE, 4);

    const tooMany = new Team({
      name: 'Overfull',
      memberIds: Array.from({ length: MAX_TEAM_SIZE + 1 }, userId),
    });

    await assert.rejects(tooMany.validate(), /memberIds/);
  });

  test('T.5  exactly MAX_TEAM_SIZE members is fine', async () => {
    const full = new Team({
      name: 'Exactly Full',
      memberIds: Array.from({ length: MAX_TEAM_SIZE }, userId),
    });

    await full.validate();
    assert.equal(full.memberIds.length, MAX_TEAM_SIZE);
  });
});

describe('the unique name', () => {
  test('T.6  two teams cannot share a name', async () => {
    await Team.create({ name: 'Team Rocket' });

    await assert.rejects(
      Team.create({ name: 'Team Rocket' }),
      (err) => err.code === 11000
    );
  });

  test('T.7  names that differ only in case collide too', async () => {
    await Team.create({ name: 'Team Rocket' });

    await assert.rejects(
      Team.create({ name: 'team rocket' }),
      (err) => err.code === 11000
    );
  });

  test('T.7b a genuinely different name is fine', async () => {
    await Team.create({ name: 'Team Rocket' });
    const other = await Team.create({ name: 'Team Magma' });

    assert.equal(other.name, 'Team Magma');
    assert.equal(await Team.countDocuments(), 2);
  });
});

describe('persistence', () => {
  test('T.8  timestamps are set on save', async () => {
    const team = await Team.create({ name: 'Timestamped' });

    assert.ok(team.createdAt instanceof Date);
    assert.ok(team.updatedAt instanceof Date);
  });

  test('T.9  createdBy is optional but kept when given', async () => {
    const creator = userId();
    const team = await Team.create({ name: 'Created By Someone', createdBy: creator });

    assert.equal(team.createdBy.toString(), creator.toString());
  });

  test('T.10 toJSON drops __v', async () => {
    const team = await Team.create({ name: 'Serialized' });
    const json = team.toJSON();

    assert.equal(json.__v, undefined);
    assert.ok(json._id);
  });
});
