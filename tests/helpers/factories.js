/**
 * Test fixtures. Keep construction here so a schema change is a one-file fix.
 */
const request = require('supertest');
const { backendRequire } = require('./backend');

const createApp = backendRequire('app');
const User = backendRequire('models/User');

const DEFAULT_PASSWORD = 'supersecret123';

/** A supertest agent bound to the real Express app (no port is opened). */
function api() {
  return request(createApp());
}

/** Authorization header for a token. */
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Create a user with an arbitrary role. Needed because POST /api/auth/register
 * only ever creates hackers - there is no way to make an organizer over HTTP.
 */
async function makeUser({
  firstName = 'Test',
  lastName = 'User',
  email,
  password = DEFAULT_PASSWORD,
  role = 'hacker',
} = {}) {
  const passwordHash = await User.hashPassword(password);
  return User.create({ firstName, lastName, email, passwordHash, role });
}

/** Create a user of the given role and return a valid token for them. */
async function makeUserAndToken(agent, options = {}) {
  const user = await makeUser(options);
  const res = await agent
    .post('/api/auth/login')
    .send({ email: user.email, password: options.password || DEFAULT_PASSWORD });
  return { user, token: res.body.token };
}

/** A valid Schedule Event payload; override any field per test. */
function eventPayload(overrides = {}) {
  return {
    title: 'Opening Ceremony',
    startTime: '2026-08-14T09:00:00Z',
    endTime: '2026-08-14T10:00:00Z',
    location: 'Main Auditorium',
    category: 'Main',
    ...overrides,
  };
}

module.exports = {
  api,
  bearer,
  makeUser,
  makeUserAndToken,
  eventPayload,
  DEFAULT_PASSWORD,
};
