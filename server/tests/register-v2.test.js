const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');
const { User } = require('../src/models');

// 注：用户名统一 ≥3 字符（User 模型校验 len [3,50]，常设种子规则），
// brief 中的 u1/u1b/u3 相应改为 user1/user1b/user3，断言不变。

async function setup() {
  const app = await getTestApp();
  const admin = await createAdmin('regadmin');
  return { app, admin };
}

test('本文件库中首个账户(createAdmin)为 admin 角色', async () => {
  await setup();
  const first = await User.findOne({ where: { username: 'regadmin' } });
  assert.strictEqual(first.role, 'admin');
});

test('已有账户后,无邀请码注册被拒', async () => {
  const { app } = await setup();
  const res = await request(app).post('/api/auth/register').send({
    username: 'noob', password: 'pass123456', mode: 'create',
    memberData: { name: '无码', gender: '女' } });
  assert.strictEqual(res.status, 400);
});

test('通用码 + mode=create:新成员 + self link + me 返回', async () => {
  const { app, admin } = await setup();
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const res = await createUser('user1', { inviteCode: inv.code, memberData: { name: '新一', gender: '女' } });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.user.role, 'member');
  // 注册响应直接带本人成员（v2：无需等 /auth/me）
  assert.strictEqual(res.body.data.selfMember.name, '新一');
  const me = await auth(request(app).get('/api/auth/me'), res.body.data.token);
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.body.data.selfMember.name, '新一');
  // 邀请码已消耗
  const res2 = await createUser('user1b', { inviteCode: inv.code, memberData: { name: '重复用', gender: '女' } });
  assert.strictEqual(res2.status, 400);
});

test('专属码 + mode=claim:认领指定成员;认领他人已绑定成员被拒', async () => {
  const { app, admin } = await setup();
  // admin 先建一个待认领成员
  const m = await auth(request(app).post('/api/family-members'), admin.token)
    .send({ name: '待认领爸', gender: '男', relationship: '父亲' });
  const inv = await inviteService.createInvite({ createdById: admin.userId, memberId: m.body.data.id });
  const res = await createUser('dad', { inviteCode: inv.code, mode: 'claim', claimMemberId: m.body.data.id });
  assert.strictEqual(res.status, 201);
  const me = await auth(request(app).get('/api/auth/me'), res.body.data.token);
  assert.strictEqual(me.body.data.selfMember.id, m.body.data.id);

  // 第二人再认领同一成员 → 409
  const inv2 = await inviteService.createInvite({ createdById: admin.userId });
  const res2 = await createUser('impostor', {
    inviteCode: inv2.code, mode: 'claim', claimMemberId: m.body.data.id });
  assert.strictEqual(res2.status, 409);

  // 专属码认领别的成员 → 400
  const other = await auth(request(app).post('/api/family-members'), admin.token)
    .send({ name: '别人', gender: '女', relationship: '母亲' });
  const inv3 = await inviteService.createInvite({ createdById: admin.userId, memberId: other.body.data.id });
  const res3 = await createUser('user3', {
    inviteCode: inv3.code, mode: 'claim', claimMemberId: m.body.data.id });
  assert.strictEqual(res3.status, 400);
});

test('bind-self:老账户补绑', async () => {
  const { app, admin } = await setup();
  // 构造无 self 的老账户:admin 账户在 helper 中已有 self;直接用邀请码注册新用户后删其 self link 模拟
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser('legacy', { inviteCode: inv.code, memberData: { name: 'legacy本人', gender: '男' } });
  const token = reg.body.data.token;
  const { UserMemberLink } = require('../src/models');
  const uid = reg.body.data.user.id;
  await UserMemberLink.destroy({ where: { userId: uid, role: 'self' } });
  // 再补绑(claim 一个新成员)
  const m = await auth(request(app).post('/api/family-members'), admin.token)
    .send({ name: '补绑对象', gender: '男', relationship: '家人' });
  const res = await auth(request(app).post('/api/members/bind-self'), token)
    .send({ mode: 'claim', claimMemberId: m.body.data.id });
  assert.strictEqual(res.status, 200);
});

test('update-profile:改 displayName 后 /auth/me 反映;消毒截断;未登录 401', async () => {
  const { app, admin } = await setup();
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser('profile1', { inviteCode: inv.code, memberData: { name: '资人', gender: '男' } });
  const token = reg.body.data.token;

  const res = await auth(request(app).post('/api/auth/update-profile'), token)
    .send({ displayName: '小明' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.displayName, '小明');
  assert.strictEqual(res.body.data.username, 'profile1');
  assert.strictEqual(res.body.data.role, 'member');

  // 消毒 + 截断到 50(HTML 标签转义,长度钳制)
  const long = await auth(request(app).post('/api/auth/update-profile'), token)
    .send({ displayName: `<b>昵</b>${'称'.repeat(60)}` });
  assert.strictEqual(long.status, 200);
  assert.ok(long.body.data.displayName.length <= 50);
  assert.ok(!long.body.data.displayName.includes('<b>'));

  // /auth/me 反映新 displayName
  const me = await auth(request(app).get('/api/auth/me'), token);
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.body.data.user.displayName, long.body.data.displayName);

  // 空值 → 400;实体展开越界 → 400(而非落库校验 500);未登录 → 401
  const empty = await auth(request(app).post('/api/auth/update-profile'), token)
    .send({ displayName: '   ' });
  assert.strictEqual(empty.status, 400);
  const overflow = await auth(request(app).post('/api/auth/update-profile'), token)
    .send({ displayName: `${'称'.repeat(49)}&` }); // 转义后 53 字符
  assert.strictEqual(overflow.status, 400);
  const anon = await request(app).post('/api/auth/update-profile').send({ displayName: '匿名' });
  assert.strictEqual(anon.status, 401);
});
