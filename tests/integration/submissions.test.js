/**
 * Project Submission over HTTP (design doc §1.2.4, §4, §5's `submissionRouter`).
 *
 * §4: "Each Project Submission belongs to a Team … only one submission exists
 * per team", and every teammate sees the same one. That team-scoping - rather
 * than user-scoping - is what most of this file exists to prove.
 *
 * Teams are created through `teamService` in the setup below because **there is
 * no HTTP route that creates one** (phase 4 - §5's router list has no team
 * router). Manual QA hits exactly the same constraint; see manual-qa.md §15.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { api, bearer, makeUserAndToken } = require('../helpers/factories');
const { backendRequire, backendDependency } = require('../helpers/backend');

const mongoose = backendDependency('mongoose');
const teamService = backendRequire('services/teamService');
const HackathonConfig = backendRequire('models/HackathonConfig');
const Submission = backendRequire('models/Submission');

const agent = api();

const HOUR = 60 * 60 * 1000;
const MISSING_ID = new mongoose.Types.ObjectId();

let bobby; // hacker, on Team Rocket
let jessie; // hacker, on Team Rocket - Bobby's teammate
let loner; // hacker, on no team at all
let rival; // hacker, on Team Magma
let organizer;
let rocket;

/** A valid submission payload; override any field per test. */
const payload = (overrides = {}) => ({
  title: 'Ignition Dashboard',
  description: 'A dashboard for hackers.',
  ...overrides,
});

const post = (token, body) => agent.post('/api/submissions').set(bearer(token)).send(body);
const patch = (token, id, body) =>
  agent.patch(`/api/submissions/${id}`).set(bearer(token)).send(body);
const getMine = (token) => agent.get('/api/submissions/mine').set(bearer(token));
const getAll = (token) => agent.get('/api/submissions').set(bearer(token));

/** A config whose deadline has not passed. */
const openConfig = () =>
  HackathonConfig.create({
    hackathonStartAt: new Date(Date.now() - HOUR),
    hackathonEndAt: new Date(Date.now() + 2 * HOUR),
  });

before(connect);
after(disconnect);
beforeEach(async () => {
  await clear();

  bobby = await makeUserAndToken(agent, { email: 'bobby@example.com', role: 'hacker' });
  jessie = await makeUserAndToken(agent, { email: 'jessie@example.com', role: 'hacker' });
  loner = await makeUserAndToken(agent, { email: 'loner@example.com', role: 'hacker' });
  rival = await makeUserAndToken(agent, { email: 'rival@example.com', role: 'hacker' });
  organizer = await makeUserAndToken(agent, { email: 'sally@example.com', role: 'organizer' });

  rocket = await teamService.createTeam({ name: 'Team Rocket' });
  await teamService.addMember(rocket._id, bobby.user._id);
  await teamService.addMember(rocket._id, jessie.user._id);

  const magma = await teamService.createTeam({ name: 'Team Magma' });
  await teamService.addMember(magma._id, rival.user._id);
});

describe('access control', () => {
  test('S.1  every route requires a token', async () => {
    const responses = await Promise.all([
      agent.get('/api/submissions/mine'),
      agent.get('/api/submissions'),
      agent.post('/api/submissions').send(payload()),
      agent.patch(`/api/submissions/${MISSING_ID}`).send({ title: 'x' }),
    ]);

    for (const res of responses) {
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    }
  });

  test('S.9  an organizer cannot POST - they have no team to submit for', async () => {
    await openConfig();
    const res = await post(organizer.token, payload());

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  test('S.24 GET /api/submissions is organizer/admin only', async () => {
    const res = await getAll(bobby.token);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });
});

describe('POST /api/submissions', () => {
  test('S.2  a hacker on a team submits for that team', async () => {
    await openConfig();
    const res = await post(bobby.token, payload());

    assert.equal(res.status, 201);
    assert.equal(res.body.data.title, 'Ignition Dashboard');
    assert.equal(res.body.data.teamId, rocket._id.toString());
    assert.equal(res.body.data.submittedBy, bobby.user._id.toString());
    assert.ok(res.body.data.submittedAt);
  });

  test('S.3  a spoofed teamId in the body is ignored - the caller team wins', async () => {
    await openConfig();
    const res = await post(bobby.token, payload({ teamId: MISSING_ID.toString() }));

    assert.equal(res.status, 201);
    assert.equal(res.body.data.teamId, rocket._id.toString());
  });

  test('S.4  a hacker with no team gets 409 NO_TEAM, not a 400 or a 404', async () => {
    await openConfig();
    const res = await post(loner.token, payload());

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'NO_TEAM');
    assert.match(res.body.error.message, /team/i);
  });

  test('S.5  submitting twice for the same team is a 409', async () => {
    await openConfig();
    await post(bobby.token, payload());
    const res = await post(bobby.token, payload({ title: 'Second attempt' }));

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.equal(await Submission.countDocuments(), 1);
  });

  test('S.6  a TEAMMATE submitting after the first is also a 409 - it is team-scoped', async () => {
    await openConfig();
    await post(bobby.token, payload());
    const res = await post(jessie.token, payload({ title: 'Jessie tries too' }));

    assert.equal(res.status, 409);
    assert.equal(await Submission.countDocuments(), 1);
  });

  test('S.7  a missing title is a 400 with details', async () => {
    await openConfig();
    const res = await post(bobby.token, payload({ title: undefined }));

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.length > 0);
  });

  test('S.8  an invalid devpostUrl is a 400', async () => {
    await openConfig();
    const res = await post(bobby.token, payload({ devpostUrl: 'devpost.com/nope' }));

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });
});

describe('GET /api/submissions/mine', () => {
  test('S.10 before submitting it is 200 with data: null, NOT a 404', async () => {
    const res = await getMine(bobby.token);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data, null);
  });

  test('S.11 after submitting it returns the submission', async () => {
    await openConfig();
    await post(bobby.token, payload());

    const res = await getMine(bobby.token);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'Ignition Dashboard');
    assert.equal(res.body.data.teamId, rocket._id.toString());
  });

  test('S.12 a teammate sees the SAME submission (§4)', async () => {
    await openConfig();
    const mine = await post(bobby.token, payload());

    const res = await getMine(jessie.token);

    assert.equal(res.status, 200);
    assert.equal(res.body.data._id, mine.body.data._id);
  });

  test('S.13 a hacker with no team gets 200 and data: null, not an error', async () => {
    const res = await getMine(loner.token);

    assert.equal(res.status, 200);
    assert.equal(res.body.data, null);
  });
});

describe('PATCH /api/submissions/:id', () => {
  /** Submit as Bobby and hand back the new submission's id. */
  async function submitAsBobby() {
    await openConfig();
    const res = await post(bobby.token, payload());
    return res.body.data;
  }

  test('S.14 updates the title, bumps updatedAt, leaves submittedAt alone', async () => {
    const original = await submitAsBobby();

    await new Promise((resolve) => setTimeout(resolve, 10));
    const res = await patch(bobby.token, original._id, { title: 'Ignition Dashboard v2' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'Ignition Dashboard v2');
    assert.equal(res.body.data.submittedAt, original.submittedAt);
    assert.ok(new Date(res.body.data.updatedAt) > new Date(original.updatedAt));
  });

  test('S.15 a teammate can edit the same submission', async () => {
    const original = await submitAsBobby();
    const res = await patch(jessie.token, original._id, { description: 'Now with tests.' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.description, 'Now with tests.');
  });

  test('S.16 a hacker on another team cannot touch it', async () => {
    const original = await submitAsBobby();
    const res = await patch(rival.token, original._id, { title: 'Sabotage' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');

    const unchanged = await Submission.findById(original._id);
    assert.equal(unchanged.title, 'Ignition Dashboard');
  });

  test('S.16b a hacker with no team cannot touch it either', async () => {
    const original = await submitAsBobby();
    const res = await patch(loner.token, original._id, { title: 'Sabotage' });

    assert.equal(res.status, 403);
  });

  test('S.17 a missing id is a 404 and a malformed id is a 400', async () => {
    await openConfig();

    const missing = await patch(bobby.token, MISSING_ID, { title: 'x' });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'NOT_FOUND');

    const malformed = await patch(bobby.token, 'not-an-id', { title: 'x' });
    assert.equal(malformed.status, 400);
  });

  test('S.18 PATCH cannot move the submission to another team', async () => {
    const original = await submitAsBobby();
    const res = await patch(bobby.token, original._id, { teamId: MISSING_ID.toString() });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.teamId, rocket._id.toString());
  });

  test('S.18b PATCH cannot rewrite submittedBy', async () => {
    const original = await submitAsBobby();
    const res = await patch(bobby.token, original._id, { submittedBy: rival.user._id.toString() });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.submittedBy, bobby.user._id.toString());
  });
});

describe('the deadline (§1.2.4 - read from config, never hardcoded)', () => {
  test('S.19 POST after submissionDeadline is 403 SUBMISSION_CLOSED', async () => {
    await HackathonConfig.create({
      hackathonStartAt: new Date(Date.now() - 3 * HOUR),
      hackathonEndAt: new Date(Date.now() + HOUR),
      submissionDeadline: new Date(Date.now() - HOUR),
    });

    const res = await post(bobby.token, payload());

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'SUBMISSION_CLOSED');
    assert.equal(await Submission.countDocuments(), 0);
  });

  test('S.20 PATCH after the deadline is 403 too - the content is frozen', async () => {
    await openConfig();
    const original = (await post(bobby.token, payload())).body.data;

    // Move the deadline into the past, then try to edit.
    const config = await HackathonConfig.getSingleton();
    config.submissionDeadline = new Date(Date.now() - HOUR);
    await config.save();

    const res = await patch(bobby.token, original._id, { title: 'Late edit' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'SUBMISSION_CLOSED');
  });

  test('S.21 with no submissionDeadline set, hackathonEndAt is the deadline', async () => {
    await HackathonConfig.create({
      hackathonStartAt: new Date(Date.now() - 3 * HOUR),
      hackathonEndAt: new Date(Date.now() - HOUR), // already over
    });

    const res = await post(bobby.token, payload());

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'SUBMISSION_CLOSED');
  });

  test('S.21b a submissionDeadline still in the future allows the write', async () => {
    await HackathonConfig.create({
      hackathonStartAt: new Date(Date.now() - HOUR),
      hackathonEndAt: new Date(Date.now() + 2 * HOUR),
      submissionDeadline: new Date(Date.now() + HOUR),
    });

    const res = await post(bobby.token, payload());
    assert.equal(res.status, 201);
  });

  test('S.22 with NO config at all the write succeeds - fail open, by design', async () => {
    // A missing config must never silently lock every team out of submitting.
    assert.equal(await HackathonConfig.countDocuments(), 0);

    const res = await post(bobby.token, payload());
    assert.equal(res.status, 201);
  });
});

describe('GET /api/submissions (judging)', () => {
  test('S.23 an organizer sees every submission', async () => {
    await openConfig();
    await post(bobby.token, payload());
    await post(rival.token, payload({ title: 'Magma Project' }));

    const res = await getAll(organizer.token);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.count, 2);
    assert.equal(res.body.data.submissions.length, 2);
  });

  test('S.23b an empty list is a count of 0, not a 404', async () => {
    const res = await getAll(organizer.token);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.count, 0);
    assert.deepEqual(res.body.data.submissions, []);
  });
});
