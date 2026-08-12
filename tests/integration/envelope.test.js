/**
 * The API response envelope and error contract (design doc §5).
 *
 * These tests are about the CONTRACT rather than any one route: every /api
 * response is `{ success, data }` or `{ success, error: { code, message } }`.
 * Per-route behaviour is covered in the other integration files - this file
 * exists so a route that forgets the envelope fails somewhere obvious.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { api, bearer, makeUserAndToken, eventPayload } = require('../helpers/factories');

const agent = api();

// A well-formed ObjectId that is guaranteed not to exist.
const MISSING_ID = '000000000000000000000000';

let hacker;
let organizer;

before(connect);
after(disconnect);
beforeEach(async () => {
  await clear();
  hacker = await makeUserAndToken(agent, { email: 'bobby@example.com', role: 'hacker' });
  organizer = await makeUserAndToken(agent, { email: 'sally@example.com', role: 'organizer' });
});

/** Assert the success envelope and hand back `data` for further assertions. */
function expectSuccess(res, status = 200) {
  assert.equal(res.status, status);
  assert.equal(res.body.success, true, 'expected success: true');
  assert.ok('data' in res.body, 'expected a data key');
  assert.equal(res.body.error, undefined, 'a success response must not carry an error');
  return res.body.data;
}

/** Assert the failure envelope and hand back `error`. */
function expectFailure(res, status, code) {
  assert.equal(res.status, status);
  assert.equal(res.body.success, false, 'expected success: false');
  assert.equal(res.body.data, undefined, 'a failure response must not carry data');
  assert.ok(res.body.error, 'expected an error object');
  assert.equal(res.body.error.code, code);
  assert.equal(typeof res.body.error.message, 'string');
  assert.ok(res.body.error.message.length > 0, 'error.message must not be empty');
  return res.body.error;
}

const createEvent = (overrides) =>
  agent.post('/api/schedule').set(bearer(organizer.token)).send(eventPayload(overrides));

describe('success envelope', () => {
  test('E.1  a successful GET returns { success: true, data }', async () => {
    const res = await agent.get('/api/users/me').set(bearer(hacker.token));
    const data = expectSuccess(res);
    assert.equal(data.email, 'bobby@example.com');
  });

  test('E.2  a list nests { count, events } under data and count matches', async () => {
    await createEvent();
    await createEvent({ title: 'Lunch', category: 'Food', endTime: undefined });

    const res = await agent.get('/api/schedule').set(bearer(hacker.token));
    const data = expectSuccess(res);

    assert.equal(data.count, 2);
    assert.ok(Array.isArray(data.events));
    assert.equal(data.count, data.events.length);
  });

  test('E.3  a successful POST returns 201 with the created resource in data', async () => {
    const res = await createEvent();
    const data = expectSuccess(res, 201);

    assert.equal(data.title, 'Opening Ceremony');
    assert.ok(data._id);
  });
});

describe('failure envelope', () => {
  test('E.4  a 404 carries error.code NOT_FOUND and a message', async () => {
    const res = await agent.get(`/api/schedule/${MISSING_ID}`).set(bearer(hacker.token));
    expectFailure(res, 404, 'NOT_FOUND');
  });

  test('E.5  a validation failure is 400 VALIDATION_ERROR with a non-empty details array', async () => {
    const res = await createEvent({ title: '   ' });
    const error = expectFailure(res, 400, 'VALIDATION_ERROR');

    assert.ok(Array.isArray(error.details), 'expected error.details to be an array');
    assert.ok(error.details.length > 0, 'expected at least one detail');
  });

  test('E.5b a malformed ObjectId is 400 VALIDATION_ERROR', async () => {
    const res = await agent.get('/api/schedule/not-an-id').set(bearer(hacker.token));
    expectFailure(res, 400, 'VALIDATION_ERROR');
  });

  test('E.5c a controller-thrown 400 is BAD_REQUEST, with no details array', async () => {
    const res = await agent.get('/api/schedule?day=Aug-14').set(bearer(hacker.token));
    const error = expectFailure(res, 400, 'BAD_REQUEST');
    assert.equal(error.details, undefined);
  });

  test('E.6  a missing token is 401 UNAUTHORIZED', async () => {
    const res = await agent.get('/api/schedule');
    expectFailure(res, 401, 'UNAUTHORIZED');
  });

  test('E.7  the wrong role is 403 FORBIDDEN', async () => {
    const res = await agent.post('/api/schedule').set(bearer(hacker.token)).send(eventPayload());
    expectFailure(res, 403, 'FORBIDDEN');
  });

  test('E.8  a duplicate key is 409 CONFLICT', async () => {
    const res = await agent.post('/api/auth/register').send({
      firstName: 'Bobby',
      lastName: 'Brown',
      email: 'bobby@example.com', // already exists
      password: 'supersecret123',
    });
    expectFailure(res, 409, 'CONFLICT');
  });

  test('E.9  an unknown route is 404 in the failure envelope', async () => {
    const res = await agent.get('/api/nope').set(bearer(hacker.token));
    expectFailure(res, 404, 'NOT_FOUND');
  });

  test('E.10 no failure response leaks internals', async () => {
    const responses = await Promise.all([
      agent.get('/api/schedule'),
      agent.get('/api/schedule/not-an-id').set(bearer(hacker.token)),
      agent.get(`/api/schedule/${MISSING_ID}`).set(bearer(hacker.token)),
      createEvent({ title: '   ' }),
    ]);

    for (const res of responses) {
      const keys = Object.keys(res.body.error);
      for (const key of keys) {
        assert.ok(
          ['code', 'message', 'details'].includes(key),
          `unexpected key "${key}" in the error envelope`
        );
      }
      assert.equal(res.body.stack, undefined);
      assert.equal(res.body.error.stack, undefined);
      assert.equal(res.body.error.name, undefined);
    }
  });
});

describe('documented exceptions', () => {
  test('E.11 GET /health is exempt from the envelope', async () => {
    const res = await agent.get('/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
    assert.equal(res.body.success, undefined, '/health is an ops endpoint, outside /api');
  });

  test('E.12 DELETE returns 200 with a body, not 204 (§5 lists no 204)', async () => {
    const created = await createEvent();
    const id = created.body.data._id;

    const res = await agent.delete(`/api/schedule/${id}`).set(bearer(organizer.token));
    const data = expectSuccess(res, 200);

    assert.equal(data.deleted, true);
    assert.equal(data.id, id);

    const after = await agent.get(`/api/schedule/${id}`).set(bearer(hacker.token));
    assert.equal(after.status, 404);
  });
});
