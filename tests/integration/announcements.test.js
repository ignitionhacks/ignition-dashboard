/**
 * Announcements: access control, sorting, pagination (design doc §1.2.2, §4).
 *
 * §4: "Announcements are created by Organizers. authorId references a User whose
 * role is organizer or admin. This is enforced at the authorization layer, not
 * just by convention, so a hacker account can never successfully create one even
 * if they call the route directly." I.3-I.5 are that guarantee.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { api, bearer, makeUserAndToken } = require('../helpers/factories');

const agent = api();

const MISSING_ID = '000000000000000000000000';

let hacker;
let organizer;
let admin;

before(connect);
after(disconnect);
beforeEach(async () => {
  await clear();
  hacker = await makeUserAndToken(agent, { email: 'bobby@example.com', role: 'hacker' });
  organizer = await makeUserAndToken(agent, {
    firstName: 'Sally',
    lastName: 'Organizer',
    email: 'sally@example.com',
    role: 'organizer',
  });
  admin = await makeUserAndToken(agent, { email: 'admin@example.com', role: 'admin' });
});

const post = (token, payload) =>
  agent.post('/api/announcements').set(bearer(token)).send(payload);

const announcement = (overrides = {}) => ({
  title: 'Lunch',
  body: 'Lunch is served in the cafeteria.',
  ...overrides,
});

/** Create N announcements as the organizer, oldest first, one second apart. */
async function seedFeed() {
  const base = new Date('2026-08-14T12:00:00Z').getTime();
  const oldest = await post(
    organizer.token,
    announcement({ title: 'Oldest', postedAt: new Date(base).toISOString() })
  );
  const middle = await post(
    organizer.token,
    announcement({ title: 'Middle', postedAt: new Date(base + 60_000).toISOString() })
  );
  const newest = await post(
    organizer.token,
    announcement({ title: 'Newest', postedAt: new Date(base + 120_000).toISOString() })
  );
  return {
    oldestId: oldest.body.data._id,
    middleId: middle.body.data._id,
    newestId: newest.body.data._id,
  };
}

describe('access control (§4)', () => {
  test('I.1  reading without a token is 401', async () => {
    const res = await agent.get('/api/announcements');
    assert.equal(res.status, 401);
  });

  test('I.2  a hacker can read the feed', async () => {
    const res = await agent.get('/api/announcements').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data.announcements, []);
  });

  test('I.3  a hacker cannot create one, even calling the route directly', async () => {
    const res = await post(hacker.token, announcement());

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  test('I.4  a hacker cannot update one', async () => {
    const created = await post(organizer.token, announcement());
    const res = await agent
      .patch(`/api/announcements/${created.body.data._id}`)
      .set(bearer(hacker.token))
      .send({ body: 'Hacked.' });

    assert.equal(res.status, 403);
  });

  test('I.5  a hacker cannot delete one', async () => {
    const created = await post(organizer.token, announcement());
    const res = await agent
      .delete(`/api/announcements/${created.body.data._id}`)
      .set(bearer(hacker.token));

    assert.equal(res.status, 403);
  });

  test('I.6  an organizer can create one', async () => {
    const res = await post(organizer.token, announcement());

    assert.equal(res.status, 201);
    assert.equal(res.body.data.title, 'Lunch');
    assert.equal(res.body.data.body, 'Lunch is served in the cafeteria.');
    assert.equal(res.body.data.pinned, false);
    assert.ok(res.body.data.postedAt);
  });

  test('I.7  an admin can create one', async () => {
    const res = await post(admin.token, announcement({ title: 'From the admin' }));
    assert.equal(res.status, 201);
  });
});

describe('authorship', () => {
  test('I.8  authorId and authorName come from the token, not the body', async () => {
    const res = await post(
      organizer.token,
      announcement({ authorId: hacker.user._id.toString(), authorName: 'Somebody Else' })
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.data.authorId, organizer.user._id.toString());
    assert.equal(res.body.data.authorName, 'Sally Organizer');
  });

  test('I.8b authorName is a snapshot - renaming the author later does not rewrite it', async () => {
    const created = await post(organizer.token, announcement());

    await agent
      .patch('/api/users/me')
      .set(bearer(organizer.token))
      .send({ firstName: 'Sal' });

    const res = await agent.get('/api/announcements').set(bearer(hacker.token));

    assert.equal(res.body.data.announcements[0]._id, created.body.data._id);
    assert.equal(res.body.data.announcements[0].authorName, 'Sally Organizer');
  });
});

describe('validation', () => {
  test('I.9  a missing body is 400 with details', async () => {
    const res = await post(organizer.token, { title: 'No body' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.length > 0);
  });

  test('I.9b a whitespace-only body is 400', async () => {
    const res = await post(organizer.token, announcement({ body: '   ' }));
    assert.equal(res.status, 400);
  });

  test('I.10 a body with no title is fine - title is optional', async () => {
    const res = await post(organizer.token, { body: 'Doors open at 9.' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.title, '');
  });
});

describe('sorting (§1.2.2)', () => {
  test('I.11 the feed is newest-first', async () => {
    await seedFeed();
    const res = await agent.get('/api/announcements').set(bearer(hacker.token));

    assert.deepEqual(
      res.body.data.announcements.map((a) => a.title),
      ['Newest', 'Middle', 'Oldest']
    );
  });

  test('I.12 a pinned older item sorts above an unpinned newer one', async () => {
    const { oldestId } = await seedFeed();

    await agent
      .patch(`/api/announcements/${oldestId}`)
      .set(bearer(organizer.token))
      .send({ pinned: true });

    const res = await agent.get('/api/announcements').set(bearer(hacker.token));

    assert.deepEqual(
      res.body.data.announcements.map((a) => a.title),
      ['Oldest', 'Newest', 'Middle']
    );
  });

  test('I.13 two pinned items sort newest-first among themselves', async () => {
    const { oldestId, middleId } = await seedFeed();

    for (const id of [oldestId, middleId]) {
      await agent
        .patch(`/api/announcements/${id}`)
        .set(bearer(organizer.token))
        .send({ pinned: true });
    }

    const res = await agent.get('/api/announcements').set(bearer(hacker.token));

    assert.deepEqual(
      res.body.data.announcements.map((a) => a.title),
      ['Middle', 'Oldest', 'Newest']
    );
  });
});

describe('pagination (§1.2.2)', () => {
  test('I.14 ?limit=2 returns two rows, with the collection-wide total', async () => {
    await seedFeed();
    const res = await agent.get('/api/announcements?limit=2').set(bearer(hacker.token));

    assert.equal(res.body.data.count, 2);
    assert.equal(res.body.data.announcements.length, 2);
    assert.equal(res.body.data.total, 3);
    assert.equal(res.body.data.limit, 2);
    assert.equal(res.body.data.page, 1);
  });

  test('I.15 ?page=2 returns the next slice and does not overlap page 1', async () => {
    await seedFeed();

    const first = await agent.get('/api/announcements?limit=2&page=1').set(bearer(hacker.token));
    const second = await agent.get('/api/announcements?limit=2&page=2').set(bearer(hacker.token));

    assert.deepEqual(
      first.body.data.announcements.map((a) => a.title),
      ['Newest', 'Middle']
    );
    assert.deepEqual(
      second.body.data.announcements.map((a) => a.title),
      ['Oldest']
    );
    assert.equal(second.body.data.total, 3);
  });

  test('I.15b a page past the end is an empty list, not a 404', async () => {
    await seedFeed();
    const res = await agent.get('/api/announcements?page=99').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.count, 0);
    assert.equal(res.body.data.total, 3);
  });

  test('I.16 limit and page are clamped, never rejected', async () => {
    await seedFeed();

    const huge = await agent.get('/api/announcements?limit=999').set(bearer(hacker.token));
    const garbage = await agent.get('/api/announcements?limit=abc').set(bearer(hacker.token));
    const zeroPage = await agent.get('/api/announcements?page=0').set(bearer(hacker.token));

    assert.equal(huge.status, 200);
    assert.equal(huge.body.data.limit, 50);
    assert.equal(garbage.body.data.limit, 10);
    assert.equal(zeroPage.body.data.page, 1);
  });
});

describe('update and delete', () => {
  test('I.17 PATCH updates the body and bumps updatedAt', async () => {
    const created = await post(organizer.token, announcement());
    const id = created.body.data._id;

    const res = await agent
      .patch(`/api/announcements/${id}`)
      .set(bearer(organizer.token))
      .send({ body: 'Lunch has moved to the atrium.' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.body, 'Lunch has moved to the atrium.');
    assert.equal(res.body.data.postedAt, created.body.data.postedAt);
  });

  test('I.18 PATCH cannot rewrite the author', async () => {
    const created = await post(organizer.token, announcement());

    const res = await agent
      .patch(`/api/announcements/${created.body.data._id}`)
      .set(bearer(admin.token))
      .send({ authorId: admin.user._id.toString(), authorName: 'Not Sally' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.authorName, 'Sally Organizer');
  });

  test('I.19 PATCH a missing id is 404, a malformed id is 400', async () => {
    const missing = await agent
      .patch(`/api/announcements/${MISSING_ID}`)
      .set(bearer(organizer.token))
      .send({ body: 'x' });
    const malformed = await agent
      .patch('/api/announcements/not-an-id')
      .set(bearer(organizer.token))
      .send({ body: 'x' });

    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'NOT_FOUND');
    assert.equal(malformed.status, 400);
  });

  test('I.20 DELETE removes it from the feed', async () => {
    const created = await post(organizer.token, announcement());
    const id = created.body.data._id;

    const res = await agent.delete(`/api/announcements/${id}`).set(bearer(organizer.token));
    const feed = await agent.get('/api/announcements').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.deleted, true);
    assert.equal(res.body.data.id, id);
    assert.equal(feed.body.data.total, 0);
  });

  test('I.20c DELETE a missing id is 404, a malformed id is 400', async () => {
    const missing = await agent
      .delete(`/api/announcements/${MISSING_ID}`)
      .set(bearer(organizer.token));
    const malformed = await agent
      .delete('/api/announcements/not-an-id')
      .set(bearer(organizer.token));

    assert.equal(missing.status, 404);
    assert.equal(malformed.status, 400);
  });
});
