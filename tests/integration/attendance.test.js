/** Attendance checklist, headcount and manual entry (design doc §3.2.2). */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { api, bearer, makeUserAndToken, eventPayload } = require('../helpers/factories');
const { backendRequire } = require('../helpers/backend');

const ScheduleEvent = backendRequire('models/ScheduleEvent');
const QRCode = backendRequire('models/QRCode');
const Attendance = backendRequire('models/Attendance');

const agent = api();

before(async () => {
  await connect();
  await QRCode.syncIndexes();
  await Attendance.syncIndexes();
});
after(disconnect);
beforeEach(clear);

async function seedRoles() {
  const hacker = await makeUserAndToken(agent, {
    firstName: 'Bobby',
    lastName: 'Brown',
    email: 'bobby@example.com',
    role: 'hacker',
  });
  const other = await makeUserAndToken(agent, {
    firstName: 'Casey',
    lastName: 'Coder',
    email: 'casey@example.com',
    role: 'hacker',
  });
  const organizer = await makeUserAndToken(agent, {
    email: 'sally@example.com',
    role: 'organizer',
  });
  const mentor = await makeUserAndToken(agent, { email: 'mo@example.com', role: 'mentor' });
  const admin = await makeUserAndToken(agent, { email: 'root@example.com', role: 'admin' });
  return { hacker, other, organizer, mentor, admin };
}

/** Two Food events and one Workshop, deliberately created out of time order. */
async function seedEvents() {
  const dinner = await ScheduleEvent.create(
    eventPayload({
      title: 'Dinner',
      category: 'Food',
      startTime: '2026-08-14T18:00:00Z',
      endTime: '2026-08-14T19:00:00Z',
      location: 'Floor 4',
    })
  );
  const lunch = await ScheduleEvent.create(
    eventPayload({
      title: 'Lunch',
      category: 'Food',
      startTime: '2026-08-14T11:30:00Z',
      endTime: '2026-08-14T12:30:00Z',
      location: 'Floor 4',
    })
  );
  const workshop = await ScheduleEvent.create(
    eventPayload({ title: 'Intro to React', category: 'Workshop' })
  );
  return { lunch, dinner, workshop };
}

/** Check a user into an event the way the real system does - via a scan. */
async function scanInto(organizerToken, userToken, event) {
  const qr = await agent.get('/api/qrcode/me').set(bearer(userToken));
  return agent
    .post('/api/qrcode/scan')
    .set(bearer(organizerToken))
    .send({ code: qr.body.code, scheduleEventId: event._id.toString() });
}

describe('GET /api/attendance/me', () => {
  test('rejects a request with no token', async () => {
    const res = await agent.get('/api/attendance/me');
    assert.equal(res.status, 401);
  });

  test('a hacker who has attended NOTHING still gets the full checklist', async () => {
    const { hacker } = await seedRoles();
    await seedEvents();

    const res = await agent.get('/api/attendance/me').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2, 'both Food events must appear');
    assert.ok(Array.isArray(res.body.checklist));
    for (const row of res.body.checklist) {
      assert.equal(row.checkedIn, false);
      assert.equal(row.checkedInAt, null);
    }
  });

  test('only Food events appear - a Workshop is not on the checklist', async () => {
    const { hacker } = await seedRoles();
    await seedEvents();

    const res = await agent.get('/api/attendance/me').set(bearer(hacker.token));

    const titles = res.body.checklist.map((r) => r.title);
    assert.deepEqual(titles.includes('Intro to React'), false);
  });

  test('rows are ordered by startTime, not creation order', async () => {
    const { hacker } = await seedRoles();
    await seedEvents(); // Dinner is created first, Lunch second

    const res = await agent.get('/api/attendance/me').set(bearer(hacker.token));

    assert.deepEqual(
      res.body.checklist.map((r) => r.title),
      ['Lunch', 'Dinner']
    );
  });

  test('each row carries the event detail the checklist renders', async () => {
    const { hacker } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent.get('/api/attendance/me').set(bearer(hacker.token));
    const row = res.body.checklist.find((r) => r.title === 'Lunch');

    assert.equal(row.scheduleEventId, lunch._id.toString());
    assert.equal(row.location, 'Floor 4');
    assert.equal(row.day, '2026-08-14');
    assert.ok(row.startTime);
  });

  test('a scan ticks exactly one box and leaves the rest unchecked', async () => {
    const { hacker, organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    await scanInto(organizer.token, hacker.token, lunch);
    const res = await agent.get('/api/attendance/me').set(bearer(hacker.token));

    const lunchRow = res.body.checklist.find((r) => r.title === 'Lunch');
    const dinnerRow = res.body.checklist.find((r) => r.title === 'Dinner');

    assert.equal(lunchRow.checkedIn, true);
    assert.ok(lunchRow.checkedInAt);
    assert.equal(dinnerRow.checkedIn, false);
  });

  test("one hacker's check-in never appears on another hacker's checklist", async () => {
    const { hacker, other, organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    await scanInto(organizer.token, hacker.token, lunch);
    const res = await agent.get('/api/attendance/me').set(bearer(other.token));

    for (const row of res.body.checklist) {
      assert.equal(row.checkedIn, false);
    }
  });

  test('attendance at a non-Food event does not add a checklist row', async () => {
    const { hacker, organizer } = await seedRoles();
    const { workshop } = await seedEvents();

    await scanInto(organizer.token, hacker.token, workshop);
    const res = await agent.get('/api/attendance/me').set(bearer(hacker.token));

    assert.equal(res.body.count, 2);
    assert.equal(
      res.body.checklist.some((r) => r.title === 'Intro to React'),
      false
    );
  });

  test('no Food events at all is an empty checklist, not an error', async () => {
    const { hacker } = await seedRoles();

    const res = await agent.get('/api/attendance/me').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 0);
    assert.deepEqual(res.body.checklist, []);
  });

  test('no Attendance rows are created just by reading the checklist', async () => {
    const { hacker } = await seedRoles();
    await seedEvents();

    await agent.get('/api/attendance/me').set(bearer(hacker.token));
    await agent.get('/api/attendance/me').set(bearer(hacker.token));

    assert.equal(await Attendance.countDocuments(), 0);
  });
});

describe('GET /api/attendance/event/:scheduleEventId', () => {
  test('an organizer sees everyone checked in', async () => {
    const { hacker, other, organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    await scanInto(organizer.token, hacker.token, lunch);
    await scanInto(organizer.token, other.token, lunch);

    const res = await agent
      .get(`/api/attendance/event/${lunch._id}`)
      .set(bearer(organizer.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
  });

  test('each row names the hacker, so the headcount is readable', async () => {
    const { hacker, organizer } = await seedRoles();
    const { lunch } = await seedEvents();
    await scanInto(organizer.token, hacker.token, lunch);

    const res = await agent
      .get(`/api/attendance/event/${lunch._id}`)
      .set(bearer(organizer.token));

    assert.equal(res.body.attendance[0].user.email, 'bobby@example.com');
    assert.equal(res.body.attendance[0].user.fullName, 'Bobby Brown');
  });

  test('an admin can read a headcount', async () => {
    const { admin } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent.get(`/api/attendance/event/${lunch._id}`).set(bearer(admin.token));
    assert.equal(res.status, 200);
  });

  test('a hacker cannot read a headcount', async () => {
    const { hacker } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent.get(`/api/attendance/event/${lunch._id}`).set(bearer(hacker.token));
    assert.equal(res.status, 403);
  });

  test('an event nobody attended is an empty list, not a 404', async () => {
    const { organizer } = await seedRoles();
    const { dinner } = await seedEvents();

    const res = await agent
      .get(`/api/attendance/event/${dinner._id}`)
      .set(bearer(organizer.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 0);
  });

  test('a malformed event id is a 400', async () => {
    const { organizer } = await seedRoles();
    const res = await agent.get('/api/attendance/event/not-an-id').set(bearer(organizer.token));
    assert.equal(res.status, 400);
  });

  test('an unknown event id is a 404', async () => {
    const { organizer } = await seedRoles();
    const res = await agent
      .get('/api/attendance/event/64b7f0000000000000000000')
      .set(bearer(organizer.token));
    assert.equal(res.status, 404);
  });

  test('never leaks a password hash', async () => {
    const { hacker, organizer } = await seedRoles();
    const { lunch } = await seedEvents();
    await scanInto(organizer.token, hacker.token, lunch);

    const res = await agent
      .get(`/api/attendance/event/${lunch._id}`)
      .set(bearer(organizer.token));

    assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
  });
});

describe('POST /api/attendance', () => {
  test('a hacker cannot mark themselves attended', async () => {
    const { hacker } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent
      .post('/api/attendance')
      .set(bearer(hacker.token))
      .send({ userId: hacker.user._id.toString(), scheduleEventId: lunch._id.toString() });

    assert.equal(res.status, 403);
    assert.equal(await Attendance.countDocuments(), 0);
  });

  test('an organizer can record attendance manually', async () => {
    const { hacker, organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent
      .post('/api/attendance')
      .set(bearer(organizer.token))
      .send({ userId: hacker.user._id.toString(), scheduleEventId: lunch._id.toString() });

    assert.equal(res.status, 201);
    assert.equal(res.body.attendance.checkedIn, true);
    assert.equal(res.body.attendance.checkedInBy, organizer.user._id.toString());
  });

  test('a mentor can too (§3.2.2)', async () => {
    const { hacker, mentor } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent
      .post('/api/attendance')
      .set(bearer(mentor.token))
      .send({ userId: hacker.user._id.toString(), scheduleEventId: lunch._id.toString() });

    assert.equal(res.status, 201);
  });

  test('the manual route and a scan produce the same result', async () => {
    const { hacker, organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    await agent
      .post('/api/attendance')
      .set(bearer(organizer.token))
      .send({ userId: hacker.user._id.toString(), scheduleEventId: lunch._id.toString() });

    const checklist = await agent.get('/api/attendance/me').set(bearer(hacker.token));
    const row = checklist.body.checklist.find((r) => r.title === 'Lunch');

    assert.equal(row.checkedIn, true);
  });

  test('recording twice is a 200, not a duplicate row', async () => {
    const { hacker, organizer } = await seedRoles();
    const { lunch } = await seedEvents();
    const body = {
      userId: hacker.user._id.toString(),
      scheduleEventId: lunch._id.toString(),
    };

    await agent.post('/api/attendance').set(bearer(organizer.token)).send(body);
    const second = await agent.post('/api/attendance').set(bearer(organizer.token)).send(body);

    assert.equal(second.status, 200);
    assert.equal(second.body.alreadyCheckedIn, true);
    assert.equal(await Attendance.countDocuments(), 1);
  });

  test('a scan after a manual entry does not duplicate either', async () => {
    const { hacker, organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    await agent
      .post('/api/attendance')
      .set(bearer(organizer.token))
      .send({ userId: hacker.user._id.toString(), scheduleEventId: lunch._id.toString() });

    const scan = await scanInto(organizer.token, hacker.token, lunch);

    assert.equal(scan.status, 200);
    assert.equal(scan.body.alreadyCheckedIn, true);
    assert.equal(await Attendance.countDocuments(), 1);
  });

  test('a missing userId is a 400', async () => {
    const { organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent
      .post('/api/attendance')
      .set(bearer(organizer.token))
      .send({ scheduleEventId: lunch._id.toString() });

    assert.equal(res.status, 400);
  });

  test('a malformed userId is a 400', async () => {
    const { organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent
      .post('/api/attendance')
      .set(bearer(organizer.token))
      .send({ userId: 'not-an-id', scheduleEventId: lunch._id.toString() });

    assert.equal(res.status, 400);
  });

  test('an unknown userId is a 404', async () => {
    const { organizer } = await seedRoles();
    const { lunch } = await seedEvents();

    const res = await agent
      .post('/api/attendance')
      .set(bearer(organizer.token))
      .send({
        userId: '64b7f0000000000000000000',
        scheduleEventId: lunch._id.toString(),
      });

    assert.equal(res.status, 404);
  });

  test('an unknown scheduleEventId is a 404', async () => {
    const { hacker, organizer } = await seedRoles();

    const res = await agent
      .post('/api/attendance')
      .set(bearer(organizer.token))
      .send({
        userId: hacker.user._id.toString(),
        scheduleEventId: '64b7f0000000000000000000',
      });

    assert.equal(res.status, 404);
  });
});
