const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, request } = require('./helpers/app');

test('GET /api/health 返回 OK', async () => {
  const app = await getTestApp();
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'OK');
});

test('未知 API 返回 404 包结构', async () => {
  const app = await getTestApp();
  const res = await request(app).get('/api/nope');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
});
