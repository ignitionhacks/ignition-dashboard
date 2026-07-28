/** Schedule Events: CRUD, validation, filtering and sorting (design doc SS2.2.1). */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { api, bearer, makeUserAndToken, eventPayload } = require('../helpers/factories');

const agent = api();

let hacker;
let organizer;

before(connect);
after(disconnect);
beforeEach(async () => {
  await clear();
  hacker = await makeUserAndToken(agent, { email: 'bobby@example.com', role: 'hacker' });
  organizer = await makeUserAndToken(agent, { email: 'sally@example.com', role: 'organizer' });
});

/** Create an event as the organizer. */
const createEvent = (overrides) =>
  agent.post('/api/schedule').set(bearer(organizer.token)).send(eventPayload(overrides));

/** Four valid events: three on Aug 14, one on Aug 15. */
async function seedEvents() {
  const opening = await createEvent();
  await createEvent({
    title: 'Lunch',
    startTime: '2026-08-14T12:00:00Z',
    endTime: undefined,
    location: 'Cafeteria',
    category: 'Food',
  });
  await createEvent({
    title: 'Clash Royale',
    startTime: '2026-08-14T08:00:00Z',
    endTime: undefined,
    location: 'Lounge',
    category: 'Fun',
  });
  await createEvent({
    title: 'Closing Ceremony',
    startTime: '2026-08-15T14:00:00Z',
    endTime: undefined,
    location: 'Main Auditorium',
    category: 'Main',
  });
  return { openingId: opening.body._id };
}

describe('access control', () => {
  test('reading the schedule requires a token', async () => {
    const res = await agent.get('/api/schedule');
    assert.equal(res.status, 401);
  });

  test('a hacker can read the schedule', async () => {
    const res = await agent.get('/api/schedule').set(bearer(hacker.token));
    assert.equal(res.status, 200);
  });

  test('a hacker cannot create an event', async () => {
    const res = await agent
      .post('/api/schedule')
      .set(bearer(hacker.token))
      .send(eventPayload({ title: 'Sneaky Event' }));

    assert.equal(res.status, 403);
  });

  test('a hacker cannot update or delete an event', async () => {
    const { openingId } = await seedEvents();

    const patch = await agent
      .patch(`/api/schedule/${openingId}`)
      .set(bearer(hacker.token))
      .send({ location: 'Hacked' });
    const remove = await agent.delete(`/api/schedule/${openingId}`).set(bearer(hacker.token));

    assert.equal(patch.status, 403);
    assert.equal(remove.status, 403);
  });
});

describe('POST /api/schedule', () => {
  test('an organizer can create an event', async () => {
    const res = await createEvent();
    assert.equal(res.status, 201);
  });

  test('trims whitespace from the title', async () => {
    const res = await createEvent({ title: '  Opening Ceremony  ' });
    assert.equal(res.body.title, 'Opening Ceremony');
  });

  test('derives day from startTime', async () => {
    const res = await createEvent();
    assert.equal(res.body.day, '2026-08-14');
  });

  test('derives isFoodEvent from the category', async () => {
    const main = await createEvent();
    const food = await createEvent({
      title: 'Lunch',
      category: 'Food',
      location: 'Cafeteria',
      endTime: undefined,
    });

    assert.equal(main.body.isFoodEvent, false);
    assert.equal(food.body.isFoodEvent, true);
  });
});

describe('validation', () => {
  test('rejects a blank title', async () => {
    const res = await createEvent({ title: '   ' });
    assert.equal(res.status, 400);
  });

  test('rejects a blank location', async () => {
    const res = await createEvent({ location: '   ' });
    assert.equal(res.status, 400);
  });

  test('rejects a missing startTime', async () => {
    const res = await createEvent({ startTime: undefined, endTime: undefined });
    assert.equal(res.status, 400);
  });

  test('rejects a category outside the enum', async () => {
    const res = await createEvent({ category: 'Networking' });
    assert.equal(res.status, 400);
  });

  test('rejects an endTime before startTime', async () => {
    const res = await createEvent({
      startTime: '2026-08-14T10:00:00Z',
      endTime: '2026-08-14T09:00:00Z',
    });
    assert.equal(res.status, 400);
  });
});

describe('GET /api/schedule', () => {
  test('returns every valid event', async () => {
    await seedEvents();
    const res = await agent.get('/api/schedule').set(bearer(hacker.token));
    assert.equal(res.body.count, 4);
  });

  test('sorts by startTime ascending', async () => {
    await seedEvents();
    const res = await agent.get('/api/schedule').set(bearer(hacker.token));
    const times = res.body.events.map((e) => e.startTime);

    assert.deepEqual(times, [...times].sort());
  });

  test('filters by day', async () => {
    await seedEvents();
    const res = await agent.get('/api/schedule?day=2026-08-14').set(bearer(hacker.token));
    assert.equal(res.body.count, 3);
  });

  test('filters by category', async () => {
    await seedEvents();
    const res = await agent.get('/api/schedule?category=Food').set(bearer(hacker.token));
    assert.equal(res.body.count, 1);
  });

  test('combines the day and category filters', async () => {
    await seedEvents();
    const res = await agent
      .get('/api/schedule?day=2026-08-14&category=Main')
      .set(bearer(hacker.token));

    assert.equal(res.body.count, 1);
  });

  test('rejects a malformed day', async () => {
    const res = await agent.get('/api/schedule?day=Aug-14').set(bearer(hacker.token));
    assert.equal(res.status, 400);
  });
});

describe('GET /api/schedule/:id and /upcoming', () => {
  test('returns a single event by id', async () => {
    const { openingId } = await seedEvents();
    const res = await agent.get(`/api/schedule/${openingId}`).set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Opening Ceremony');
  });

  test('returns 404 for a well-formed id that does not exist', async () => {
    const res = await agent
      .get('/api/schedule/64b7f0000000000000000000')
      .set(bearer(hacker.token));
    assert.equal(res.status, 404);
  });

  test('returns 400 for a malformed id', async () => {
    const res = await agent.get('/api/schedule/not-an-id').set(bearer(hacker.token));
    assert.equal(res.status, 400);
  });

  test('caps /upcoming at the requested limit', async () => {
    await seedEvents();
    const res = await agent.get('/api/schedule/upcoming?limit=2').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.ok(res.body.count <= 2, `expected at most 2 events, got ${res.body.count}`);
  });
});

describe('PATCH and DELETE /api/schedule/:id', () => {
  test('an organizer can update an event', async () => {
    const { openingId } = await seedEvents();
    const res = await agent.patch(`/api/schedule/${openingId}`).set(bearer(organizer.token)).send({
      location: 'Grand Hall',
      startTime: '2026-08-15T09:00:00Z',
      endTime: '2026-08-15T10:00:00Z',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.location, 'Grand Hall');
  });

  test('re-derives day when startTime changes', async () => {
    const { openingId } = await seedEvents();
    const res = await agent.patch(`/api/schedule/${openingId}`).set(bearer(organizer.token)).send({
      startTime: '2026-08-15T09:00:00Z',
      endTime: '2026-08-15T10:00:00Z',
    });

    assert.equal(res.body.day, '2026-08-15');
  });

  test('re-runs validators on update', async () => {
    // Moving startTime past the existing endTime must fail, not silently save.
    const { openingId } = await seedEvents();
    const res = await agent
      .patch(`/api/schedule/${openingId}`)
      .set(bearer(organizer.token))
      .send({ startTime: '2026-08-16T09:00:00Z' });

    assert.equal(res.status, 400);
  });

  test('an organizer can delete an event, after which it is gone', async () => {
    const { openingId } = await seedEvents();
    const remove = await agent.delete(`/api/schedule/${openingId}`).set(bearer(organizer.token));
    const after = await agent.get(`/api/schedule/${openingId}`).set(bearer(hacker.token));

    assert.equal(remove.status, 204);
    assert.equal(after.status, 404);
  });
});
