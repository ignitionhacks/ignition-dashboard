const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { connect, disconnect } = require('../helpers/db');
const { api } = require('../helpers/factories');

const agent = api();

before(connect);
after(disconnect);

test('GET /health returns ok', async () => {
  const res = await agent.get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('unknown route returns a 404 JSON error, not an HTML page', async () => {
  const res = await agent.get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.ok(res.body.error, 'expected an { error } body');
});
