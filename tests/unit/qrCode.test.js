/**
 * Model-level tests for QRCode (design doc §3.2.1).
 *
 * Unlike the other unit files this one opens a database. The two guarantees that
 * matter most here - one code per user, and no two users sharing a code - are
 * enforced by unique *indexes*, not by validators, so `validate()` alone cannot
 * prove them. Testing them in memory would prove nothing about the real thing.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { connect, clear, disconnect } = require('../helpers/db');
const { backendRequire } = require('../helpers/backend');

const QRCode = backendRequire('models/QRCode');
const mongoose = require('../helpers/db').mongoose;

const userId = () => new mongoose.Types.ObjectId();

before(async () => {
  await connect();
  // Build the unique indexes up front - mongoose creates them lazily, and the
  // duplicate-key tests below are meaningless until they exist.
  await QRCode.syncIndexes();
});
after(disconnect);
beforeEach(clear);

describe('validation', () => {
  test('requires a userId', async () => {
    await assert.rejects(() => new QRCode({}).validate());
  });

  test('accepts a document with just a userId', async () => {
    await new QRCode({ userId: userId() }).validate();
  });
});

describe('code generation', () => {
  test('generates a code when none is supplied', () => {
    const qr = new QRCode({ userId: userId() });
    assert.equal(typeof qr.code, 'string');
    assert.ok(qr.code.length > 0);
  });

  test('generates a different code for each document', () => {
    const a = new QRCode({ userId: userId() });
    const b = new QRCode({ userId: userId() });
    assert.notEqual(a.code, b.code);
  });

  test('the code is not guessable - a UUID, not a counter or the user id', () => {
    const id = userId();
    const qr = new QRCode({ userId: id });
    assert.match(qr.code, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.notEqual(qr.code, id.toString());
  });

  test('the code never changes once created (§3.2.1: generated once)', async () => {
    const qr = await QRCode.create({ userId: userId() });
    const original = qr.code;

    qr.code = 'tampered';
    await qr.save();

    const reloaded = await QRCode.findById(qr._id);
    assert.equal(reloaded.code, original);
  });
});

describe('uniqueness', () => {
  test('a user cannot have two QR codes', async () => {
    const id = userId();
    await QRCode.create({ userId: id });

    await assert.rejects(
      () => QRCode.create({ userId: id }),
      (err) => err.code === 11000
    );
  });

  test('two users cannot share a code', async () => {
    const code = 'a-fixed-code-value';
    await QRCode.create({ userId: userId(), code });

    await assert.rejects(
      () => QRCode.create({ userId: userId(), code }),
      (err) => err.code === 11000
    );
  });

  test('different users get their own codes', async () => {
    const a = await QRCode.create({ userId: userId() });
    const b = await QRCode.create({ userId: userId() });

    assert.notEqual(a.code, b.code);
    assert.equal(await QRCode.countDocuments(), 2);
  });
});

describe('serialization', () => {
  test('drops the internal version key', () => {
    const json = new QRCode({ userId: userId() }).toJSON();
    assert.equal(json.__v, undefined);
  });

  test('exposes the raw code string - the frontend renders the image, not us', () => {
    const qr = new QRCode({ userId: userId() });
    const json = qr.toJSON();
    assert.equal(json.code, qr.code);
  });
});
