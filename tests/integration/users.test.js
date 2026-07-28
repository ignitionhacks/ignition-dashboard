/** Token handling, self-service profile, user lookup and role management (SS1.2.1). */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { api, bearer, makeUserAndToken } = require('../helpers/factories');

const agent = api();

before(connect);
after(disconnect);
beforeEach(clear);

/** A hacker, an organizer and an admin, each with a live token. */
async function seedRoles() {
  const hacker = await makeUserAndToken(agent, {
    firstName: 'Bobby',
    lastName: 'Hacker',
    email: 'bobby@example.com',
    role: 'hacker',
  });
  const organizer = await makeUserAndToken(agent, {
    firstName: 'Sally',
    lastName: 'Organizer',
    email: 'sally@example.com',
    role: 'organizer',
  });
  const admin = await makeUserAndToken(agent, {
    firstName: 'Root',
    lastName: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
  });
  return { hacker, organizer, admin };
}

describe('token handling on GET /api/users/me', () => {
  test('rejects a request with no token', async () => {
    const res = await agent.get('/api/users/me');
    assert.equal(res.status, 401);
  });

  test('rejects a token sent without the "Bearer " prefix', async () => {
    const { hacker } = await seedRoles();
    const res = await agent.get('/api/users/me').set({ Authorization: hacker.token });
    assert.equal(res.status, 401);
  });

  test('rejects a garbage token', async () => {
    const res = await agent.get('/api/users/me').set(bearer('garbage.token.here'));
    assert.equal(res.status, 401);
  });

  test('returns the caller profile for a valid token', async () => {
    const { hacker } = await seedRoles();
    const res = await agent.get('/api/users/me').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.email, 'bobby@example.com');
    assert.equal(res.body.fullName, 'Bobby Hacker');
    assert.equal(res.body.passwordHash, undefined);
  });
});

describe('PATCH /api/users/me', () => {
  test('updates the caller own name', async () => {
    const { hacker } = await seedRoles();
    const res = await agent
      .patch('/api/users/me')
      .set(bearer(hacker.token))
      .send({ firstName: 'Bob' });

    assert.equal(res.status, 200);
    assert.equal(res.body.firstName, 'Bob');
  });

  test('cannot be used to self-promote', async () => {
    const { hacker } = await seedRoles();
    const res = await agent
      .patch('/api/users/me')
      .set(bearer(hacker.token))
      .send({ role: 'admin' });

    assert.equal(res.body.role, 'hacker');
  });

  test('cannot be used to change the caller email', async () => {
    const { hacker } = await seedRoles();
    const res = await agent
      .patch('/api/users/me')
      .set(bearer(hacker.token))
      .send({ email: 'someone-else@example.com' });

    assert.equal(res.body.email, 'bobby@example.com');
  });
});

describe('GET /api/users/:id', () => {
  test('is forbidden for a hacker', async () => {
    const { hacker } = await seedRoles();
    const res = await agent.get(`/api/users/${hacker.user._id}`).set(bearer(hacker.token));
    assert.equal(res.status, 403);
  });

  test('is allowed for an organizer', async () => {
    const { hacker, organizer } = await seedRoles();
    const res = await agent.get(`/api/users/${hacker.user._id}`).set(bearer(organizer.token));
    assert.equal(res.status, 200);
  });
});

describe('PATCH /api/users/:id/role', () => {
  test('is forbidden for an organizer - admins only', async () => {
    const { hacker, organizer } = await seedRoles();
    const res = await agent
      .patch(`/api/users/${hacker.user._id}/role`)
      .set(bearer(organizer.token))
      .send({ role: 'organizer' });

    assert.equal(res.status, 403);
  });

  test('rejects a role outside the enum', async () => {
    const { hacker, admin } = await seedRoles();
    const res = await agent
      .patch(`/api/users/${hacker.user._id}/role`)
      .set(bearer(admin.token))
      .send({ role: 'wizard' });

    assert.equal(res.status, 400);
  });

  test('lets an admin promote a hacker', async () => {
    const { hacker, admin } = await seedRoles();
    const res = await agent
      .patch(`/api/users/${hacker.user._id}/role`)
      .set(bearer(admin.token))
      .send({ role: 'organizer' });

    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'organizer');
  });

  test('a promotion takes effect on an already-issued token', async () => {
    // requireAuth re-reads the user from the DB every request, so a role change
    // applies immediately instead of waiting for the old token to expire.
    const { hacker, admin } = await seedRoles();
    await agent
      .patch(`/api/users/${hacker.user._id}/role`)
      .set(bearer(admin.token))
      .send({ role: 'organizer' });

    const res = await agent.post('/api/schedule').set(bearer(hacker.token)).send({
      title: 'Added After Promotion',
      startTime: '2026-08-15T16:00:00Z',
      location: 'Main Auditorium',
      category: 'Main',
    });

    assert.equal(res.status, 201);
  });
});
