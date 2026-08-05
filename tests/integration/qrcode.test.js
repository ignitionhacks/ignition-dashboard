/** QR code issuing, scanning and lookup (design doc §3.2.1). */
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

/** One of each role that matters here, each with a live token. */
async function seedRoles() {
  const hacker = await makeUserAndToken(agent, {
    firstName: 'Bobby',
    lastName: 'Brown',
    email: 'bobby@example.com',
    role: 'hacker',
  });
  const organizer = await makeUserAndToken(agent, {
    email: 'sally@example.com',
    role: 'organizer',
  });
  const mentor = await makeUserAndToken(agent, {
    email: 'mo@example.com',
    role: 'mentor',
  });
  const admin = await makeUserAndToken(agent, {
    email: 'root@example.com',
    role: 'admin',
  });
  return { hacker, organizer, mentor, admin };
}

const makeLunch = () =>
  ScheduleEvent.create(eventPayload({ title: 'Lunch', category: 'Food' }));

describe('GET /api/qrcode/me', () => {
  test('rejects a request with no token', async () => {
    const res = await agent.get('/api/qrcode/me');
    assert.equal(res.status, 401);
  });

  test('issues a code on the first call', async () => {
    const { hacker } = await seedRoles();

    const res = await agent.get('/api/qrcode/me').set(bearer(hacker.token));

    assert.equal(res.status, 200);
    assert.equal(typeof res.body.code, 'string');
    assert.ok(res.body.code.length > 0);
    assert.equal(res.body.userId, hacker.user._id.toString());
  });

  test('returns the SAME code on every later call, and creates no duplicate', async () => {
    const { hacker } = await seedRoles();

    const first = await agent.get('/api/qrcode/me').set(bearer(hacker.token));
    const second = await agent.get('/api/qrcode/me').set(bearer(hacker.token));

    assert.equal(second.body.code, first.body.code);
    assert.equal(await QRCode.countDocuments(), 1);
  });

  test('two hackers never receive the same code', async () => {
    const { hacker, organizer } = await seedRoles();

    const a = await agent.get('/api/qrcode/me').set(bearer(hacker.token));
    const b = await agent.get('/api/qrcode/me').set(bearer(organizer.token));

    assert.notEqual(a.body.code, b.body.code);
  });

  test('concurrent first calls still yield one code, not a 500', async () => {
    const { hacker } = await seedRoles();

    const responses = await Promise.all([
      agent.get('/api/qrcode/me').set(bearer(hacker.token)),
      agent.get('/api/qrcode/me').set(bearer(hacker.token)),
      agent.get('/api/qrcode/me').set(bearer(hacker.token)),
    ]);

    for (const res of responses) assert.equal(res.status, 200);
    assert.equal(await QRCode.countDocuments(), 1);
    const codes = new Set(responses.map((r) => r.body.code));
    assert.equal(codes.size, 1);
  });

  test('never leaks a password hash', async () => {
    const { hacker } = await seedRoles();
    const res = await agent.get('/api/qrcode/me').set(bearer(hacker.token));
    assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
  });
});

describe('POST /api/qrcode/scan', () => {
  /** A hacker holding a QR code, plus a Food event to scan them into. */
  async function scanFixture() {
    const roles = await seedRoles();
    const qr = await agent.get('/api/qrcode/me').set(bearer(roles.hacker.token));
    const event = await makeLunch();
    return { ...roles, code: qr.body.code, event };
  }

  test('rejects a hacker - hackers cannot check themselves in', async () => {
    const { hacker, code, event } = await scanFixture();

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(hacker.token))
      .send({ code, scheduleEventId: event._id.toString() });

    assert.equal(res.status, 403);
    assert.equal(await Attendance.countDocuments(), 0);
  });

  test('an organizer scanning a valid code records attendance', async () => {
    const { hacker, organizer, code, event } = await scanFixture();

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(organizer.token))
      .send({ code, scheduleEventId: event._id.toString() });

    assert.equal(res.status, 201);
    assert.equal(res.body.alreadyCheckedIn, false);
    assert.equal(res.body.attendance.checkedIn, true);
    assert.equal(res.body.attendance.userId, hacker.user._id.toString());
    assert.equal(res.body.attendance.scheduleEventId, event._id.toString());
    assert.ok(res.body.attendance.checkedInAt);
  });

  test('records WHO scanned, for the audit trail', async () => {
    const { organizer, code, event } = await scanFixture();

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(organizer.token))
      .send({ code, scheduleEventId: event._id.toString() });

    assert.equal(res.body.attendance.checkedInBy, organizer.user._id.toString());
  });

  test('a mentor may also scan (§3.2.1)', async () => {
    const { mentor, code, event } = await scanFixture();

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(mentor.token))
      .send({ code, scheduleEventId: event._id.toString() });

    assert.equal(res.status, 201);
  });

  test('a duplicate scan is a 200, not an error, and does not duplicate the row', async () => {
    const { organizer, code, event } = await scanFixture();
    const body = { code, scheduleEventId: event._id.toString() };

    const first = await agent.post('/api/qrcode/scan').set(bearer(organizer.token)).send(body);
    const second = await agent.post('/api/qrcode/scan').set(bearer(organizer.token)).send(body);

    assert.equal(second.status, 200);
    assert.equal(second.body.alreadyCheckedIn, true);
    assert.equal(
      second.body.attendance.checkedInAt,
      first.body.attendance.checkedInAt,
      'the first scan time must survive a re-scan'
    );
    assert.equal(await Attendance.countDocuments(), 1);
  });

  test('an unknown code is a 404', async () => {
    const { organizer, event } = await scanFixture();

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(organizer.token))
      .send({ code: 'no-such-code', scheduleEventId: event._id.toString() });

    assert.equal(res.status, 404);
    assert.equal(await Attendance.countDocuments(), 0);
  });

  test('a missing code is a 400', async () => {
    const { organizer, event } = await scanFixture();

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(organizer.token))
      .send({ scheduleEventId: event._id.toString() });

    assert.equal(res.status, 400);
  });

  test('an unknown scheduleEventId is a 404', async () => {
    const { organizer, code } = await scanFixture();

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(organizer.token))
      .send({ code, scheduleEventId: '64b7f0000000000000000000' });

    assert.equal(res.status, 404);
  });

  test('a malformed scheduleEventId is a 400, not a 404', async () => {
    const { organizer, code } = await scanFixture();

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(organizer.token))
      .send({ code, scheduleEventId: 'not-an-id' });

    assert.equal(res.status, 400);
  });

  test('a missing scheduleEventId is a 400', async () => {
    const { organizer, code } = await scanFixture();

    const res = await agent.post('/api/qrcode/scan').set(bearer(organizer.token)).send({ code });

    assert.equal(res.status, 400);
  });

  test('scanning into a non-Food event is allowed (headcount still counts)', async () => {
    const { organizer, code } = await scanFixture();
    const workshop = await ScheduleEvent.create(
      eventPayload({ title: 'Intro to React', category: 'Workshop' })
    );

    const res = await agent
      .post('/api/qrcode/scan')
      .set(bearer(organizer.token))
      .send({ code, scheduleEventId: workshop._id.toString() });

    assert.equal(res.status, 201);
  });
});

describe('GET /api/qrcode/:code/user', () => {
  async function lookupFixture() {
    const roles = await seedRoles();
    const qr = await agent.get('/api/qrcode/me').set(bearer(roles.hacker.token));
    return { ...roles, code: qr.body.code };
  }

  test('an organizer can resolve a code to its owner', async () => {
    const { organizer, hacker, code } = await lookupFixture();

    const res = await agent.get(`/api/qrcode/${code}/user`).set(bearer(organizer.token));

    assert.equal(res.status, 200);
    assert.equal(res.body._id, hacker.user._id.toString());
    assert.equal(res.body.email, 'bobby@example.com');
  });

  test('an admin can too', async () => {
    const { admin, code } = await lookupFixture();

    const res = await agent.get(`/api/qrcode/${code}/user`).set(bearer(admin.token));
    assert.equal(res.status, 200);
  });

  test('a hacker cannot - this would expose other hackers', async () => {
    const { hacker, code } = await lookupFixture();

    const res = await agent.get(`/api/qrcode/${code}/user`).set(bearer(hacker.token));
    assert.equal(res.status, 403);
  });

  test('a mentor cannot (§3.2.1 lists organizer/admin only)', async () => {
    const { mentor, code } = await lookupFixture();

    const res = await agent.get(`/api/qrcode/${code}/user`).set(bearer(mentor.token));
    assert.equal(res.status, 403);
  });

  test('an unknown code is a 404', async () => {
    const { organizer } = await lookupFixture();

    const res = await agent.get('/api/qrcode/no-such-code/user').set(bearer(organizer.token));
    assert.equal(res.status, 404);
  });

  test('never leaks a password hash', async () => {
    const { organizer, code } = await lookupFixture();

    const res = await agent.get(`/api/qrcode/${code}/user`).set(bearer(organizer.token));
    assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
  });
});
