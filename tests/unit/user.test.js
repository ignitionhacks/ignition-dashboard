/** Model-level tests for User: password hashing, the fullName virtual, serialization. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { backendRequire } = require('../helpers/backend');

const User = backendRequire('models/User');
const { ROLES } = User;

const build = (overrides = {}) =>
  new User({
    firstName: 'Bobby',
    lastName: 'Hacker',
    email: 'bobby@example.com',
    passwordHash: 'placeholder-hash',
    ...overrides,
  });

describe('password hashing', () => {
  test('hashPassword never returns the plaintext', async () => {
    const hash = await User.hashPassword('supersecret123');
    assert.notEqual(hash, 'supersecret123');
    assert.ok(hash.length > 20);
  });

  test('the same password hashes differently each time (salted)', async () => {
    const a = await User.hashPassword('supersecret123');
    const b = await User.hashPassword('supersecret123');
    assert.notEqual(a, b);
  });

  test('verifyPassword accepts the correct password', async () => {
    const passwordHash = await User.hashPassword('supersecret123');
    const user = build({ passwordHash });
    assert.equal(await user.verifyPassword('supersecret123'), true);
  });

  test('verifyPassword rejects a wrong password', async () => {
    const passwordHash = await User.hashPassword('supersecret123');
    const user = build({ passwordHash });
    assert.equal(await user.verifyPassword('wrongpassword'), false);
  });

  test('verifyPassword returns false when the hash was not selected', async () => {
    // passwordHash is `select: false`, so a document loaded by a normal query
    // has no hash at all - that must be a clean false, not a crash.
    const user = build();
    user.passwordHash = undefined;
    assert.equal(await user.verifyPassword('supersecret123'), false);
  });
});

describe('schema', () => {
  test('defaults to the hacker role', () => {
    assert.equal(build().role, 'hacker');
  });

  test('exposes the four documented roles', () => {
    assert.deepEqual(ROLES, ['hacker', 'organizer', 'mentor', 'admin']);
  });

  test('lowercases the email', async () => {
    const user = build({ email: 'Bobby@Example.com' });
    await user.validate();
    assert.equal(user.email, 'bobby@example.com');
  });

  test('rejects a malformed email', async () => {
    await assert.rejects(() => build({ email: 'not-an-email' }).validate());
  });

  test('rejects a role outside the enum', async () => {
    await assert.rejects(() => build({ role: 'wizard' }).validate());
  });
});

describe('serialization', () => {
  test('fullName joins first and last name', () => {
    assert.equal(build().fullName, 'Bobby Hacker');
  });

  test('toJSON strips passwordHash, __v and the duplicate id', () => {
    const json = build().toJSON();

    assert.equal(json.passwordHash, undefined);
    assert.equal(json.__v, undefined);
    assert.equal(json.id, undefined);
    assert.ok(json._id, 'expected _id to survive');
  });

  test('toJSON keeps the fullName virtual', () => {
    assert.equal(build().toJSON().fullName, 'Bobby Hacker');
  });
});
