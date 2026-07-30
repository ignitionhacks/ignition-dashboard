/** Auth: registration, login, logout (design doc SS1.2.1). */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { api, bearer, DEFAULT_PASSWORD } = require('../helpers/factories');

const agent = api();

before(connect);
after(disconnect);
beforeEach(clear);

const validRegistration = (overrides = {}) => ({
  firstName: 'Bobby',
  lastName: 'Hacker',
  email: 'bobby@example.com',
  password: DEFAULT_PASSWORD,
  ...overrides,
});

describe('POST /api/auth/register', () => {
  test('creates a hacker and returns a token', async () => {
    const res = await agent.post('/api/auth/register').send(validRegistration());

    assert.equal(res.status, 201);
    assert.equal(typeof res.body.token, 'string');
    assert.ok(res.body.token.length > 0);
    assert.equal(res.body.user.role, 'hacker');
  });

  test('lowercases the email', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send(validRegistration({ email: 'Bobby@Example.com' }));

    assert.equal(res.body.user.email, 'bobby@example.com');
  });

  test('never returns the password hash', async () => {
    const res = await agent.post('/api/auth/register').send(validRegistration());
    assert.equal(res.body.user.passwordHash, undefined);
  });

  test('rejects a duplicate email with 409', async () => {
    await agent.post('/api/auth/register').send(validRegistration());
    const res = await agent
      .post('/api/auth/register')
      .send(validRegistration({ firstName: 'Other', lastName: 'Person' }));

    assert.equal(res.status, 409);
  });

  test('rejects a password under 8 characters', async () => {
    const res = await agent.post('/api/auth/register').send(validRegistration({ password: 'abc' }));
    assert.equal(res.status, 400);
  });

  test('rejects a malformed email', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send(validRegistration({ email: 'not-an-email' }));
    assert.equal(res.status, 400);
  });

  test('ignores a client-supplied role - registration only ever makes hackers', async () => {
    const res = await agent.post('/api/auth/register').send(validRegistration({ role: 'admin' }));
    assert.equal(res.body.user.role, 'hacker');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await agent.post('/api/auth/register').send(validRegistration());
  });

  test('returns a token for correct credentials', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'bobby@example.com', password: DEFAULT_PASSWORD });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  test('rejects a wrong password with 401', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'bobby@example.com', password: 'wrongpassword' });

    assert.equal(res.status, 401);
  });

  test('rejects an unknown email with 401', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: DEFAULT_PASSWORD });

    assert.equal(res.status, 401);
  });

  test('gives an identical error for wrong password and unknown email (no user enumeration)', async () => {
    const wrongPassword = await agent
      .post('/api/auth/login')
      .send({ email: 'bobby@example.com', password: 'wrongpassword' });
    const unknownEmail = await agent
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: DEFAULT_PASSWORD });

    assert.equal(wrongPassword.body.error, unknownEmail.body.error);
  });
});

describe('POST /api/auth/logout', () => {
  test('succeeds for an authenticated user', async () => {
    const reg = await agent.post('/api/auth/register').send(validRegistration());
    const res = await agent.post('/api/auth/logout').set(bearer(reg.body.token));

    assert.equal(res.status, 200);
  });
});
