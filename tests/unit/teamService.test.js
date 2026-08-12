/**
 * teamService - the only sanctioned way to change team membership.
 *
 * Membership is stored twice on purpose: `Team.memberIds` (so a team can list
 * its members) and `User.teamId` (§1.2.1: "nullable until the hacker
 * joins/creates a team", and the Profile page reads the user, not the team).
 * Every rule that keeps those two in step lives here, which is why this file is
 * the largest in `unit/` and why a future `teamRouter` would be ~40 lines of
 * glue rather than a re-implementation.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { backendRequire, backendDependency } = require('../helpers/backend');

const mongoose = backendDependency('mongoose');
const Team = backendRequire('models/Team');
const User = backendRequire('models/User');
const teamService = backendRequire('services/teamService');

const MISSING_ID = new mongoose.Types.ObjectId();

let counter = 0;
/** A saved hacker. Email has to be unique, hence the counter. */
async function makeHacker(firstName = 'Bobby') {
  counter += 1;
  return User.create({
    firstName,
    lastName: 'Hacker',
    email: `hacker${counter}@example.com`,
    passwordHash: 'not-a-real-hash',
    role: 'hacker',
  });
}

/** Assert that a thrown error is the ApiError the service promises. */
const isApiError = (status, code) => (err) =>
  err.statusCode === status && err.code === code;

before(async () => {
  await connect();
  await Team.syncIndexes();
  await User.syncIndexes();
});
after(disconnect);
beforeEach(clear);

describe('createTeam', () => {
  test('TS.1  creates an empty team', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });

    assert.equal(team.name, 'Team Rocket');
    assert.deepEqual(team.memberIds, []);
    assert.equal(await Team.countDocuments(), 1);
  });

  test('TS.2  a duplicate name is a 409, not a crash', async () => {
    await teamService.createTeam({ name: 'Team Rocket' });

    await assert.rejects(
      teamService.createTeam({ name: 'Team Rocket' }),
      isApiError(409, 'CONFLICT')
    );
  });

  test('TS.2b a name differing only in case is also a 409', async () => {
    await teamService.createTeam({ name: 'Team Rocket' });

    await assert.rejects(
      teamService.createTeam({ name: 'TEAM ROCKET' }),
      isApiError(409, 'CONFLICT')
    );
  });

  test('TS.2c a blank name is a 400', async () => {
    await assert.rejects(teamService.createTeam({ name: '  ' }), (err) => err.statusCode === 400);
  });

  test('TS.2d createdBy is recorded when given', async () => {
    const admin = await makeHacker('Admin');
    const team = await teamService.createTeam({ name: 'Provisioned', createdBy: admin._id });

    assert.equal(team.createdBy.toString(), admin._id.toString());
  });
});

describe('addMember', () => {
  test('TS.3  writes both sides: memberIds and User.teamId', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const user = await makeHacker();

    await teamService.addMember(team._id, user._id);

    const savedTeam = await Team.findById(team._id);
    const savedUser = await User.findById(user._id);

    assert.deepEqual(
      savedTeam.memberIds.map((id) => id.toString()),
      [user._id.toString()]
    );
    assert.equal(savedUser.teamId.toString(), team._id.toString());
  });

  test('TS.4  adding the same user twice is idempotent', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const user = await makeHacker();

    await teamService.addMember(team._id, user._id);
    await teamService.addMember(team._id, user._id);

    const savedTeam = await Team.findById(team._id);
    assert.equal(savedTeam.memberIds.length, 1);
  });

  test('TS.5  a user already on another team is a 409 - never two teams at once', async () => {
    const rocket = await teamService.createTeam({ name: 'Team Rocket' });
    const magma = await teamService.createTeam({ name: 'Team Magma' });
    const user = await makeHacker();

    await teamService.addMember(rocket._id, user._id);

    await assert.rejects(
      teamService.addMember(magma._id, user._id),
      isApiError(409, 'CONFLICT')
    );

    const savedUser = await User.findById(user._id);
    assert.equal(savedUser.teamId.toString(), rocket._id.toString());
  });

  test('TS.6  a full team is a 409', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });

    for (let i = 0; i < Team.MAX_TEAM_SIZE; i += 1) {
      const member = await makeHacker(`Member${i}`);
      await teamService.addMember(team._id, member._id);
    }

    const oneTooMany = await makeHacker('Extra');

    await assert.rejects(
      teamService.addMember(team._id, oneTooMany._id),
      isApiError(409, 'CONFLICT')
    );

    const savedUser = await User.findById(oneTooMany._id);
    assert.equal(savedUser.teamId, null);
  });

  test('TS.7  an unknown user is a 404', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });

    await assert.rejects(
      teamService.addMember(team._id, MISSING_ID),
      isApiError(404, 'NOT_FOUND')
    );
  });

  test('TS.7b an unknown team is a 404', async () => {
    const user = await makeHacker();

    await assert.rejects(
      teamService.addMember(MISSING_ID, user._id),
      isApiError(404, 'NOT_FOUND')
    );
  });
});

describe('removeMember', () => {
  test('TS.8  clears both sides', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const user = await makeHacker();
    await teamService.addMember(team._id, user._id);

    await teamService.removeMember(team._id, user._id);

    const savedTeam = await Team.findById(team._id);
    const savedUser = await User.findById(user._id);

    assert.deepEqual(savedTeam.memberIds, []);
    assert.equal(savedUser.teamId, null);
  });

  test('TS.9  removing someone who was never a member is a no-op, not an error', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const stranger = await makeHacker('Stranger');

    await teamService.removeMember(team._id, stranger._id);

    const savedTeam = await Team.findById(team._id);
    assert.deepEqual(savedTeam.memberIds, []);
  });

  test('TS.9b removing one member leaves the others alone', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const jessie = await makeHacker('Jessie');
    const james = await makeHacker('James');
    await teamService.addMember(team._id, jessie._id);
    await teamService.addMember(team._id, james._id);

    await teamService.removeMember(team._id, jessie._id);

    const savedTeam = await Team.findById(team._id);
    assert.deepEqual(
      savedTeam.memberIds.map((id) => id.toString()),
      [james._id.toString()]
    );
  });
});

describe('getTeamForUser', () => {
  test('TS.10 returns the team a user is on', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const user = await makeHacker();
    await teamService.addMember(team._id, user._id);

    const found = await teamService.getTeamForUser(user._id);

    assert.ok(found);
    assert.equal(found._id.toString(), team._id.toString());
    assert.equal(found.name, 'Team Rocket');
  });

  test('TS.11 returns null for a user with no team', async () => {
    const user = await makeHacker();
    assert.equal(await teamService.getTeamForUser(user._id), null);
  });

  test('TS.11b returns null for a user who does not exist', async () => {
    assert.equal(await teamService.getTeamForUser(MISSING_ID), null);
  });
});

describe('reconcile', () => {
  /**
   * The two writes (Team then User) are not in a transaction - there are none
   * on a standalone mongod or the free Atlas tier - so a process that dies
   * between them leaves drift. `reconcile()` is the repair, and
   * `Team.memberIds` is the side that wins.
   */
  test('TS.12 clears a User.teamId pointing at a team that does not list them', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const user = await makeHacker();

    // Simulate a crash after the User write but before the Team write.
    await User.updateOne({ _id: user._id }, { teamId: team._id });

    const summary = await teamService.reconcile();

    const savedUser = await User.findById(user._id);
    assert.equal(savedUser.teamId, null);
    assert.equal(summary.usersCleared, 1);
  });

  test('TS.13 sets a User.teamId for someone already listed in memberIds', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const user = await makeHacker();

    // Simulate a crash after the Team write but before the User write.
    await Team.updateOne({ _id: team._id }, { $push: { memberIds: user._id } });

    const summary = await teamService.reconcile();

    const savedUser = await User.findById(user._id);
    assert.equal(savedUser.teamId.toString(), team._id.toString());
    assert.equal(summary.usersLinked, 1);
  });

  test('TS.13b drops a memberIds entry whose user no longer exists', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    await Team.updateOne({ _id: team._id }, { $push: { memberIds: MISSING_ID } });

    const summary = await teamService.reconcile();

    const savedTeam = await Team.findById(team._id);
    assert.deepEqual(savedTeam.memberIds, []);
    assert.equal(summary.membersDropped, 1);
  });

  test('TS.14 a healthy database is left completely alone', async () => {
    const team = await teamService.createTeam({ name: 'Team Rocket' });
    const user = await makeHacker();
    await teamService.addMember(team._id, user._id);

    const summary = await teamService.reconcile();

    assert.deepEqual(summary, { usersLinked: 0, usersCleared: 0, membersDropped: 0 });

    const savedUser = await User.findById(user._id);
    const savedTeam = await Team.findById(team._id);
    assert.equal(savedUser.teamId.toString(), team._id.toString());
    assert.equal(savedTeam.memberIds.length, 1);
  });
});
