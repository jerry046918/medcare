const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');

// 注:brief 中"viewer 不能编辑成员资料;owner 可以"用例依赖 POST /:id/links(Task 11),
// 按 Task 10 预检裁定移入 Task 11 的 links-merge.test.js,此处不含。

async function setup() {
  const app = await getTestApp();
  const admin = await createAdmin('memadmin');
  return { app, admin };
}

async function makeUser(app, admin, username, memberName = `${username}本人`) {
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser(username, { inviteCode: inv.code, memberData: { name: memberName, gender: '男' } });
  return { token: reg.body.data.token, userId: reg.body.data.user.id };
}

test('列表只含可见成员且带视角 role', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'vis1');
  // admin 建家庭成员
  await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '管理员家娃', gender: '女', relationship: '女儿' });
  // 新用户只见本人
  const list = await auth(request(app).get('/api/members'), u.token);
  assert.strictEqual(list.status, 200);
  const names = list.body.data.map((m) => m.name);
  assert.ok(names.includes('vis1本人'));
  assert.ok(!names.includes('管理员家娃'));
  const mine = list.body.data.find((m) => m.name === 'vis1本人');
  assert.strictEqual(mine.role, 'self');
  assert.strictEqual(mine.relationship, '本人');
  // admin 见全部
  const adminList = await auth(request(app).get('/api/members'), admin.token);
  assert.ok(adminList.body.data.length >= 2);
});

test('创建成员建立 owner link;旧路径别名可用', async () => {
  const { app, admin } = await setup();
  const res = await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '新成员', gender: '男', relationship: '父亲' });
  assert.strictEqual(res.status, 201);
  const alias = await auth(request(app).get('/api/family-members'), admin.token);
  assert.strictEqual(alias.status, 200);
  assert.ok(alias.body.data.some((m) => m.name === '新成员'));
});

test('删除:有 self link 拒绝;无报告可删', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'del1');
  const meList = await auth(request(app).get('/api/members'), u.token);
  const selfId = meList.body.data.find((m) => m.role === 'self').id;
  const delSelf = await auth(request(app).delete(`/api/members/${selfId}`), u.token);
  assert.strictEqual(delSelf.status, 400);
  const created = await auth(request(app).post('/api/members'), u.token)
    .send({ name: '可删除', gender: '女', relationship: '女儿' });
  const del = await auth(request(app).delete(`/api/members/${created.body.data.id}`), u.token);
  assert.strictEqual(del.status, 200);
});

test('?claimable=1 返回无 self link 的成员(仅基础字段)', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'claimable1');
  // admin 再建两个待认领成员(u 的本人成员已有 self link,不应出现)
  await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '待认领A', gender: '女', relationship: '女儿' });
  await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '待认领B', gender: '男', relationship: '父亲' });
  const res = await auth(request(app).get('/api/members?claimable=1'), u.token);
  assert.strictEqual(res.status, 200);
  const names = res.body.data.map((m) => m.name);
  assert.ok(names.includes('待认领A') && names.includes('待认领B'));
  assert.ok(!names.includes('claimable1本人'));
  for (const item of res.body.data) {
    assert.deepStrictEqual(Object.keys(item).sort(), ['birthday', 'gender', 'id', 'name']);
  }
  // 已有 self 的账户补绑 → 400 先拒;摘除 self 后认领待认领成员 → 200,且其后不再出现在 claimable 列表
  const target = res.body.data.find((m) => m.name === '待认领A');
  const bind = await auth(request(app).post('/api/members/bind-self'), u.token)
    .send({ mode: 'claim', claimMemberId: target.id });
  assert.strictEqual(bind.status, 400);
  const legacy2 = await makeUser(app, admin, 'claimable2');
  const { UserMemberLink } = require('../src/models');
  await UserMemberLink.destroy({ where: { userId: legacy2.userId, role: 'self' } });
  const bind2 = await auth(request(app).post('/api/members/bind-self'), legacy2.token)
    .send({ mode: 'claim', claimMemberId: target.id });
  assert.strictEqual(bind2.status, 200);
  const again = await auth(request(app).get('/api/members?claimable=1'), u.token);
  assert.ok(!again.body.data.some((m) => m.id === target.id));
  assert.ok(again.body.data.some((m) => m.name === '待认领B'));
});
