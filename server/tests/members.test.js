const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, auth, request } = require('./helpers/app');

async function setup() {
  const app = await getTestApp();
  const { token } = await createAdmin();
  return { app, token };
}

test('创建成员→列表→详情→更新→删除 全流程', async () => {
  const { app, token } = await setup();
  const create = await auth(request(app).post('/api/family-members'), token)
    .send({ name: '测试人', gender: '男', relationship: '本人', birthday: '1990-01-01' });
  assert.strictEqual(create.status, 201);
  const id = create.body.data.id;

  const list = await auth(request(app).get('/api/family-members'), token);
  assert.strictEqual(list.status, 200);
  assert.ok(list.body.data.some(m => m.name === '测试人'));

  const detail = await auth(request(app).get(`/api/family-members/${id}`), token);
  assert.strictEqual(detail.status, 200);
  assert.strictEqual(detail.body.data.name, '测试人');

  const upd = await auth(request(app).put(`/api/family-members/${id}`), token)
    .send({ weight: 70 });
  assert.strictEqual(upd.status, 200);

  const del = await auth(request(app).delete(`/api/family-members/${id}`), token);
  assert.strictEqual(del.status, 200);
});

test('未认证访问被拒', async () => {
  const { app } = await setup();
  const res = await request(app).get('/api/family-members');
  assert.strictEqual(res.status, 401);
});

test('无效输入返回 400', async () => {
  const { app, token } = await setup();
  const res = await auth(request(app).post('/api/family-members'), token)
    .send({ name: '', gender: '男', relationship: '本人' });
  assert.strictEqual(res.status, 400);
});
