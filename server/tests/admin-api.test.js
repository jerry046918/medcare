const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');

test('非 admin:invites 403;users 基础字段可见;改角色 403', async () => {
  const app = await getTestApp();
  const admin = await createAdmin('apiadmin');
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser('plain', { inviteCode: inv.code, memberData: { name: 'plain本人', gender: '男' } });
  const t = reg.body.data.token;
  assert.strictEqual((await auth(request(app).get('/api/invites'), t)).status, 403);
  const users = await auth(request(app).get('/api/users'), t);
  assert.strictEqual(users.status, 200);
  assert.ok(users.body.data.some((u) => u.username === 'plain'));
  assert.ok(users.body.data.every((u) => !('role' in u)), '普通用户不应看到 role 字段');
  assert.strictEqual((await auth(request(app).put(`/api/users/${admin.userId}/role`), t).send({ role: 'member' })).status, 403);
});

test('admin 邀请码全流程与用户角色切换', async () => {
  const app = await getTestApp();
  // 复用本文件首个 admin(注册协议仅首账户免邀请码成为 admin,同文件第二次 createAdmin 会 400)
  const admin = await createAdmin('apiadmin');
  const created = await auth(request(app).post('/api/invites'), admin.token)
    .send({ maxUses: 3, expiresDays: 7 });
  assert.strictEqual(created.status, 201);
  const list = await auth(request(app).get('/api/invites'), admin.token);
  assert.strictEqual(list.status, 200);
  assert.ok(list.body.data.some((i) => i.code === created.body.data.code));

  const reg = await createUser('promote', {
    inviteCode: created.body.data.code, memberData: { name: 'promote本人', gender: '男' } });
  const uid = reg.body.data.user.id;
  const users = await auth(request(app).get('/api/users'), admin.token);
  assert.ok(users.body.data.some((u) => u.id === uid && u.role === 'member'));

  const promote = await auth(request(app).put(`/api/users/${uid}/role`), admin.token).send({ role: 'admin' });
  assert.strictEqual(promote.status, 200);
  const users2 = await auth(request(app).get('/api/users'), admin.token);
  assert.ok(users2.body.data.some((u) => u.id === uid && u.role === 'admin'));

  const stop = await auth(request(app).delete(`/api/invites/${created.body.data.id}`), admin.token);
  assert.strictEqual(stop.status, 200);
  const used = await createUser('stopped', {
    inviteCode: created.body.data.code, memberData: { name: 'stopped本人', gender: '男' } });
  assert.strictEqual(used.status, 400); // 仍剩次数但已停用
});

test('改角色守卫:无效角色 400;用户不存在 404;不能改自己 400', async () => {
  const app = await getTestApp();
  const admin = await createAdmin('apiadmin');
  const bad = await auth(request(app).put(`/api/users/${admin.userId}/role`), admin.token).send({ role: 'root' });
  assert.strictEqual(bad.status, 400);
  const missing = await auth(request(app).put('/api/users/999999/role'), admin.token).send({ role: 'member' });
  assert.strictEqual(missing.status, 404);
  const self = await auth(request(app).put(`/api/users/${admin.userId}/role`), admin.token).send({ role: 'member' });
  assert.strictEqual(self.status, 400);
});
