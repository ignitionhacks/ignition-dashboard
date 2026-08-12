/**
 * Hackathon config + countdown (design doc §1.2.3, §4, §5's `configRouter`).
 *
 * §4: "A HackathonConfig is a singleton, referenced implicitly by everything
 * time based" - the countdown and (in phase 5) the submission deadline both
 * read from here rather than hardcoding dates.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { api, bearer, makeUserAndToken, eventPayload } = require('../helpers/factories');
const { backendRequire } = require('../helpers/backend');

const HackathonConfig = backendRequire('models/HackathonConfig');

const agent = api();

const HOUR = 60 * 60 * 1000;

let hacker;
let organizer;
let admin;

before(connect);
after(disconnect);
beforeEach(async () => {
  await clear();
  hacker = await makeUserAndToken(agent, { email: 'bobby@example.com', role: 'hacker' });
  organizer = await makeUserAndToken(agent, { email: 'sally@example.com', role: 'organizer' });
  admin = await makeUserAndToken(agent, { email: 'admin@example.com', role: 'admin' });
});

const put = (token, payload) =>
  agent.put('/api/config/hackathon').set(bearer(token)).send(payload);

const getConfig = (token) => agent.get('/api/config/hackathon').set(bearer(token));

/** A config running right now: started an hour ago, ends in two. */
const running = (overrides = {}) => ({
  hackathonStartAt: new Date(Date.now() - HOUR).toISOString(),
  hackathonEndAt: new Date(Date.now() + 2 * HOUR).toISOString(),
  ...overrides,
});

describe('access control', () => {
  test('CI.1  GET without a token is 401', async () => {
    const res = await agent.get('/api/config/hackathon');
    assert.equal(res.status, 401);
  });

  test('CI.2  GET with nothing configured is 404, not an empty object', async () => {
    const res = await getConfig(hacker.token);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.message.length > 0);
  });

  test('CI.3  a hacker cannot write the config', async () => {
    const res = await put(hacker.token, running());

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  test('CI.4  an organizer cannot write the config either - this one is admin-only', async () => {
    const res = await put(organizer.token, running());
    assert.equal(res.status, 403);
  });

  test('CI.5  an admin can write it, and any role can read it back', async () => {
    const write = await put(admin.token, running());
    const read = await getConfig(hacker.token);

    assert.equal(write.status, 200);
    assert.equal(read.status, 200);
    assert.equal(read.body.data.hackathonEndAt, write.body.data.hackathonEndAt);
  });
});

describe('the singleton (§4)', () => {
  test('CI.6  a second PUT updates the existing document rather than adding one', async () => {
    await put(admin.token, running());
    const laterEnd = new Date(Date.now() + 5 * HOUR).toISOString();

    const second = await put(admin.token, running({ hackathonEndAt: laterEnd }));

    assert.equal(second.status, 200);
    assert.equal(second.body.data.hackathonEndAt, laterEnd);
    assert.equal(await HackathonConfig.countDocuments(), 1);
  });

  test('CI.6b the document keeps its _id across updates', async () => {
    const first = await put(admin.token, running());
    const second = await put(admin.token, running({ submissionDeadline: new Date(Date.now() + HOUR).toISOString() }));

    assert.equal(second.body.data._id, first.body.data._id);
  });
});

describe('validation', () => {
  test('CI.7  an end before the start is 400 with details', async () => {
    const res = await put(admin.token, {
      hackathonStartAt: new Date(Date.now() + 2 * HOUR).toISOString(),
      hackathonEndAt: new Date(Date.now() + HOUR).toISOString(),
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.length > 0);
  });

  test('CI.8  PUT is a full replace - a missing hackathonStartAt is 400', async () => {
    await put(admin.token, running());
    const res = await put(admin.token, { hackathonEndAt: new Date(Date.now() + HOUR).toISOString() });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('CI.8b submissionDeadline is optional, settable, and cleared by a PUT that omits it', async () => {
    const deadline = new Date(Date.now() + HOUR).toISOString();

    const withoutIt = await put(admin.token, running());
    assert.equal(withoutIt.body.data.submissionDeadline, null);

    const withIt = await put(admin.token, running({ submissionDeadline: deadline }));
    assert.equal(withIt.body.data.submissionDeadline, deadline);

    const clearedAgain = await put(admin.token, running());
    assert.equal(clearedAgain.body.data.submissionDeadline, null);
  });

  test('CI.9  fields the client does not own are ignored, not trusted', async () => {
    const res = await put(admin.token, {
      ...running(),
      _id: '000000000000000000000000',
      singleton: 'nope',
      serverTime: '1999-01-01T00:00:00.000Z',
      countdown: { formatted: '99:99:99', msRemaining: 1 },
      createdAt: '1999-01-01T00:00:00.000Z',
    });

    assert.equal(res.status, 200);
    assert.notEqual(res.body.data._id, '000000000000000000000000');
    assert.notEqual(res.body.data.serverTime, '1999-01-01T00:00:00.000Z');
    assert.notEqual(res.body.data.countdown.formatted, '99:99:99');
    assert.equal(res.body.data.singleton, undefined);
  });
});

describe('the countdown (§1.2.3)', () => {
  test('CI.10 a running hackathon counts down: started, not ended, time left', async () => {
    await put(admin.token, running());
    const res = await getConfig(hacker.token);
    const { countdown } = res.body.data;

    assert.equal(countdown.hasStarted, true);
    assert.equal(countdown.hasEnded, false);
    assert.ok(countdown.msRemaining > 0);
    assert.ok(countdown.msRemaining <= 2 * HOUR);
    assert.match(countdown.formatted, /^\d{2,}:\d{2}:\d{2}$/);
    assert.equal(countdown.endsAt, res.body.data.hackathonEndAt);
  });

  test('CI.11 after the end it clamps at zero instead of going negative', async () => {
    await put(admin.token, {
      hackathonStartAt: new Date(Date.now() - 3 * HOUR).toISOString(),
      hackathonEndAt: new Date(Date.now() - HOUR).toISOString(),
    });

    const { countdown } = (await getConfig(hacker.token)).body.data;

    assert.equal(countdown.msRemaining, 0);
    assert.equal(countdown.formatted, '00:00:00');
    assert.equal(countdown.hasEnded, true);
    assert.equal(countdown.hasStarted, true);
  });

  test('CI.12 before the start, hasStarted is false and the clock still counts to the end', async () => {
    await put(admin.token, {
      hackathonStartAt: new Date(Date.now() + HOUR).toISOString(),
      hackathonEndAt: new Date(Date.now() + 3 * HOUR).toISOString(),
    });

    const { countdown } = (await getConfig(hacker.token)).body.data;

    assert.equal(countdown.hasStarted, false);
    assert.equal(countdown.hasEnded, false);
    assert.ok(countdown.msRemaining > 2 * HOUR);
  });

  test('CI.13 serverTime is the server clock, so the client can correct for skew', async () => {
    await put(admin.token, running());
    const before = Date.now();
    const res = await getConfig(hacker.token);
    const serverTime = new Date(res.body.data.serverTime).getTime();

    assert.ok(serverTime >= before - 5000);
    assert.ok(serverTime <= Date.now() + 5000);
  });

  test('CI.14 the countdown is recomputed per request, not stored', async () => {
    await put(admin.token, running());

    const first = (await getConfig(hacker.token)).body.data.countdown.msRemaining;
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = (await getConfig(hacker.token)).body.data.countdown.msRemaining;

    assert.ok(second < first, `expected ${second} < ${first}`);
    // Nothing about the countdown is persisted - only the two timestamps are.
    const stored = await HackathonConfig.getSingleton();
    assert.equal(stored.countdown, undefined);
    assert.equal(stored.msRemaining, undefined);
  });
});

describe('GET /api/schedule/upcoming re-verified against §1.2.3', () => {
  test('CI.15 returns at most `limit` events, soonest first, in the envelope', async () => {
    for (let i = 1; i <= 7; i += 1) {
      await agent
        .post('/api/schedule')
        .set(bearer(organizer.token))
        .send(
          eventPayload({
            title: `Event ${i}`,
            startTime: new Date(Date.now() + i * HOUR).toISOString(),
            endTime: new Date(Date.now() + i * HOUR + 30 * 60 * 1000).toISOString(),
          })
        );
    }

    const res = await agent.get('/api/schedule/upcoming?limit=5').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.count, 5);
    assert.equal(res.body.data.events.length, 5);
    assert.deepEqual(
      res.body.data.events.map((e) => e.title),
      ['Event 1', 'Event 2', 'Event 3', 'Event 4', 'Event 5']
    );
  });

  test('CI.15b past events are excluded', async () => {
    await agent
      .post('/api/schedule')
      .set(bearer(organizer.token))
      .send(
        eventPayload({
          title: 'Yesterday',
          startTime: new Date(Date.now() - 24 * HOUR).toISOString(),
          endTime: new Date(Date.now() - 23 * HOUR).toISOString(),
        })
      );

    const res = await agent.get('/api/schedule/upcoming').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.count, 0);
  });
});
