const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { connect, disconnect } = require('../helpers/db');
const { api } = require('../helpers/factories');

const agent = api();

before(connect);
after(disconnect);

// /health is deliberately outside the SS5 response envelope - it is an ops
// endpoint mounted outside /api and uptime probes match this literal body.
test('GET /health returns ok, un-enveloped', async () => {
  const res = await agent.get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.success, undefined);
});

test('unknown route returns a 404 JSON error, not an HTML page', async () => {
  const res = await agent.get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});
