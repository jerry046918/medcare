const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');

async function setup() {
  const app = await getTestApp();
  const admin = await createAdmin('xadmin');
  return { app, admin };
}
async function makeUser(app, admin, username) {
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser(username, { inviteCode: inv.code, memberData: { name: `${username}本人`, gender: '男' } });
  return { token: reg.body.data.token, userId: reg.body.data.user.id };
}

test('viewer 可看报告但不可上传/编辑;editor 可上传;陌生人 404', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'repOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '报告权限对象', gender: '男', relationship: '父亲' });
  const mid = created.body.data.id;
  const rep = await auth(request(app).post('/api/reports'), owner.token)
    .field('familyMemberId', String(mid)).field('reportDate', '2026-10-03');
  assert.strictEqual(rep.status, 201);

  const viewer = await makeUser(app, admin, 'repViewer');
  await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: viewer.userId, role: 'viewer' });
  // viewer 列表可见 + 详情可见
  const list = await auth(request(app).get('/api/reports'), viewer.token);
  assert.ok(list.body.data.some((r) => r.id === rep.body.data.id));
  const detail = await auth(request(app).get(`/api/reports/${rep.body.data.id}`), viewer.token);
  assert.strictEqual(detail.status, 200);
  // viewer 不可上传
  const denied = await auth(request(app).post('/api/reports'), viewer.token)
    .field('familyMemberId', String(mid)).field('reportDate', '2026-10-03');
  assert.strictEqual(denied.status, 403);
  // viewer 不可编辑
  const upd = await auth(request(app).put(`/api/reports/${rep.body.data.id}`), viewer.token)
    .field('hospitalName', 'x医院');
  assert.strictEqual(upd.status, 403);
  // editor 可上传
  const editor = await makeUser(app, admin, 'repEditor');
  await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: editor.userId, role: 'editor' });
  const okUpload = await auth(request(app).post('/api/reports'), editor.token)
    .field('familyMemberId', String(mid)).field('reportDate', '2026-10-04');
  assert.strictEqual(okUpload.status, 201);
  // 陌生人 404
  const stranger = await makeUser(app, admin, 'repStranger');
  const gone = await auth(request(app).get(`/api/reports/${rep.body.data.id}`), stranger.token);
  assert.strictEqual(gone.status, 404);
});

test('medications/medicalLogs 同权限模型', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'medOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '用药权限对象', gender: '男', relationship: '母亲' });
  const mid = created.body.data.id;
  const viewer = await makeUser(app, admin, 'medViewer');
  await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: viewer.userId, role: 'viewer' });
  const list = await auth(request(app).get(`/api/medications/member/${mid}`), viewer.token);
  assert.strictEqual(list.status, 200);
  const create = await auth(request(app).post('/api/medications'), viewer.token)
    .send({ memberId: mid, name: '药', dosage: '1', frequency: '日' });
  assert.strictEqual(create.status, 403);
});
