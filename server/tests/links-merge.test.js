const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');

async function setup() {
  const app = await getTestApp();
  const admin = await createAdmin('linkadmin');
  return { app, admin };
}
async function makeUser(app, admin, username) {
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser(username, { inviteCode: inv.code, memberData: { name: `${username}本人`, gender: '男' } });
  return { token: reg.body.data.token, userId: reg.body.data.user.id };
}

test('授权 viewer/editor、列表、撤销', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'grantOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '授权对象', gender: '男', relationship: '父亲' });
  const mid = created.body.data.id;

  const v = await makeUser(app, admin, 'granteeV');
  const grant = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: v.userId, role: 'viewer', relationship: '亲戚' });
  assert.strictEqual(grant.status, 201);

  // 重复授权 → 409
  const dup = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: v.userId, role: 'editor' });
  assert.strictEqual(dup.status, 409);

  // 普通用户不能授 owner/self
  const bad = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: v.userId, role: 'owner' });
  assert.strictEqual(bad.status, 403);

  const links = await auth(request(app).get(`/api/members/${mid}/links`), owner.token);
  assert.strictEqual(links.status, 200);
  const viewerLink = links.body.data.find((l) => l.userId === v.userId);
  assert.strictEqual(viewerLink.role, 'viewer');

  const revoke = await auth(request(app).delete(`/api/members/${mid}/links/${viewerLink.id}`), owner.token);
  assert.strictEqual(revoke.status, 200);
  const after = await auth(request(app).get('/api/members'), v.token);
  assert.ok(!after.body.data.some((m) => m.id === mid), '撤销后不可见');
});

test('非 self link 不可删除;admin 可删 self link(解绑)', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'selfDel');
  const meList = await auth(request(app).get('/api/members'), u.token);
  const selfId = meList.body.data.find((m) => m.role === 'self').id;
  const links = await auth(request(app).get(`/api/members/${selfId}/links`), u.token);
  const selfLink = links.body.data.find((l) => l.role === 'self');
  const denied = await auth(request(app).delete(`/api/members/${selfId}/links/${selfLink.id}`), u.token);
  assert.strictEqual(denied.status, 403);
  const ok = await auth(request(app).delete(`/api/members/${selfId}/links/${selfLink.id}`), admin.token);
  assert.strictEqual(ok.status, 200);
});

test('merge:报告与 links 迁移到目标成员', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'mergeU');
  const src = await auth(request(app).post('/api/members'), u.token)
    .send({ name: '重复爸', gender: '男', relationship: '父亲' });
  const tgt = await auth(request(app).post('/api/members'), u.token)
    .send({ name: '真爸', gender: '男', relationship: '父亲' });
  const report = await auth(request(app).post('/api/reports'), u.token)
    .field('familyMemberId', String(src.body.data.id))
    .field('reportDate', '2026-10-02');
  assert.strictEqual(report.status, 201);

  const merged = await auth(request(app).post('/api/members/merge'), admin.token)
    .send({ sourceId: src.body.data.id, targetId: tgt.body.data.id });
  assert.strictEqual(merged.status, 200);

  const tgtDetail = await auth(request(app).get(`/api/members/${tgt.body.data.id}`), u.token);
  assert.ok(tgtDetail.body.data.reports.some((r) => r.id === report.body.data.id));
  const srcGone = await auth(request(app).get(`/api/members/${src.body.data.id}`), u.token);
  assert.strictEqual(srcGone.status, 404);
});

// Task 10 预检裁定移入本文件的用例:owner 可编辑资料、viewer 编辑被拒;
// owner PUT 带 relationship 只更新自己 link 的视角关系(每人各自视角)
test('owner 可编辑成员资料,viewer 编辑被拒;PUT relationship 更新视角关系', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'editOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '资料对象', gender: '男', relationship: '父亲' });
  const mid = created.body.data.id;

  const putOwner = await auth(request(app).put(`/api/members/${mid}`), owner.token)
    .send({ weight: 70 });
  assert.strictEqual(putOwner.status, 200);

  const v = await makeUser(app, admin, 'editViewer');
  const grant = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: v.userId, role: 'viewer', relationship: '亲戚' });
  assert.strictEqual(grant.status, 201);

  const putViewer = await auth(request(app).put(`/api/members/${mid}`), v.token)
    .send({ weight: 75 });
  assert.strictEqual(putViewer.status, 403);

  // owner 带 relationship 更新 → 本人视角显示新关系;viewer 的授权关系不受影响
  const putRel = await auth(request(app).put(`/api/members/${mid}`), owner.token)
    .send({ relationship: '养父' });
  assert.strictEqual(putRel.status, 200);
  const ownerList = await auth(request(app).get('/api/members'), owner.token);
  const ownerView = ownerList.body.data.find((m) => m.id === mid);
  assert.strictEqual(ownerView.relationship, '养父');
  const viewerList = await auth(request(app).get('/api/members'), v.token);
  const viewerView = viewerList.body.data.find((m) => m.id === mid);
  assert.strictEqual(viewerView.relationship, '亲戚');
});

// merge self 冲突分支 A:source 的 self link 覆盖同用户在 target 上的非 self link
test('merge:source 的 self link 迁移后覆盖同用户在 target 的非 self link', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'mergeSelfA');
  // target:admin 建成员,授 u viewer → u 在 target 为 viewer(非 self)
  const tgt = await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '合并目标A', gender: '男', relationship: '父亲' });
  const grant = await auth(request(app).post(`/api/members/${tgt.body.data.id}/links`), admin.token)
    .send({ granteeUserId: u.userId, role: 'viewer' });
  assert.strictEqual(grant.status, 201);
  // source:u 的本人成员(self link)
  const meList = await auth(request(app).get('/api/members'), u.token);
  const selfMember = meList.body.data.find((m) => m.role === 'self');

  const merged = await auth(request(app).post('/api/members/merge'), admin.token)
    .send({ sourceId: selfMember.id, targetId: tgt.body.data.id });
  assert.strictEqual(merged.status, 200);

  const list = await auth(request(app).get('/api/members'), u.token);
  const view = list.body.data.find((m) => m.id === tgt.body.data.id);
  assert.strictEqual(view.role, 'self', 'source 的 self link 应覆盖 target 上的 viewer link');
  assert.ok(!list.body.data.some((m) => m.id === selfMember.id), 'source 成员已删除');
});

// merge self 冲突分支 B:target 已有 self link 时保留,非 self link 迁移不抢占
test('merge:target 已有 self link 时保留,非 self link 迁移不抢占', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'mergeSelfB');
  // source:u 另建成员(owner link)
  const src = await auth(request(app).post('/api/members'), u.token)
    .send({ name: '合并源B', gender: '男', relationship: '父亲' });
  // target:u 的本人成员(self link)
  const meList = await auth(request(app).get('/api/members'), u.token);
  const selfMember = meList.body.data.find((m) => m.role === 'self');

  const merged = await auth(request(app).post('/api/members/merge'), admin.token)
    .send({ sourceId: src.body.data.id, targetId: selfMember.id });
  assert.strictEqual(merged.status, 200);

  const list = await auth(request(app).get('/api/members'), u.token);
  const view = list.body.data.find((m) => m.id === selfMember.id);
  assert.strictEqual(view.role, 'self', 'target 现有 self 保留,不被 owner link 迁移降级');
  assert.ok(!list.body.data.some((m) => m.id === src.body.data.id), 'source 成员已删除');
});

// admin 授权矩阵:可授任意角色;self 仅当成员未绑定;grantee 不存在 → 400
test('admin 可授 owner/self;self 仅当成员未绑定;grantee 不存在 400', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'admGrant');
  const m = await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '管理员代管', gender: '男', relationship: '父亲' });
  const mid = m.body.data.id;

  // 未绑定成员 → admin 授 self 成功(换绑纠错场景)
  const grantSelf = await auth(request(app).post(`/api/members/${mid}/links`), admin.token)
    .send({ granteeUserId: u.userId, role: 'self', relationship: '本人' });
  assert.strictEqual(grantSelf.status, 201);

  // 已有 self → 再授 self 409
  const other = await makeUser(app, admin, 'admGrant2');
  const grantSelf2 = await auth(request(app).post(`/api/members/${mid}/links`), admin.token)
    .send({ granteeUserId: other.userId, role: 'self' });
  assert.strictEqual(grantSelf2.status, 409);

  // admin 可授 owner(普通用户不行,见第一个用例)
  const grantOwner = await auth(request(app).post(`/api/members/${mid}/links`), admin.token)
    .send({ granteeUserId: other.userId, role: 'owner' });
  assert.strictEqual(grantOwner.status, 201);

  // grantee 不存在 → 400
  const noUser = await auth(request(app).post(`/api/members/${mid}/links`), admin.token)
    .send({ granteeUserId: 9999999, role: 'viewer' });
  assert.strictEqual(noUser.status, 400);
});
