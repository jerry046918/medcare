const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');
const { InviteCode } = require('../src/models');

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

// Final Finding 1a:merge 时 source 的专属邀请码改挂 target——
// 迁移库(migrate-v2 建表,FK NO ACTION)下不改挂会在 source 删除时 SQLITE_CONSTRAINT → 500;
// sync 库(FK SET NULL)下不改挂会让专属码静默降级为通用码
test('merge:source 的专属邀请码改挂 target', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'invMergeOwner');
  const src = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '码源成员', gender: '男', relationship: '父亲' });
  const tgt = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '码目标成员', gender: '女', relationship: '母亲' });
  const invite = await inviteService.createInvite(
    { createdById: admin.userId, memberId: src.body.data.id });
  assert.strictEqual(invite.memberId, src.body.data.id);

  const merged = await auth(request(app).post('/api/members/merge'), admin.token)
    .send({ sourceId: src.body.data.id, targetId: tgt.body.data.id });
  assert.strictEqual(merged.status, 200);

  const reloaded = await InviteCode.findByPk(invite.id);
  assert.strictEqual(reloaded.memberId, tgt.body.data.id, '专属码应指向合并后的目标成员');
});

// Final Finding 1b:删除成员时其专属邀请码一并清理——
// 迁移库(FK NO ACTION)下不清理会在删成员时 SQLITE_CONSTRAINT → 500
test('remove:带专属邀请码的成员可删,码随删', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'invDelOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '带码可删成员', gender: '女', relationship: '姑姑' });
  const invite = await inviteService.createInvite(
    { createdById: admin.userId, memberId: created.body.data.id });

  const del = await auth(request(app).delete(`/api/members/${created.body.data.id}`), owner.token);
  assert.strictEqual(del.status, 200);

  const gone = await InviteCode.findByPk(invite.id);
  assert.strictEqual(gone, null, '成员专属邀请码应随成员删除');
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

// Task 13 评审修正:merge 同参判定用 String 比较;source 的 self link 用户在 target 无 link
// 且 target 已有他人 self link 时,迁移 link 降级为 owner(保持一成员至多一个 self)
test('merge:字符串同参 400;self link 迁移遇 target 已有他人 self 时降级 owner', async () => {
  const { app, admin } = await setup();
  // (a) '999999' 与 999999 视为同参 → 400(修复前 strict 相等会继续执行到 404)
  const sameArg = await auth(request(app).post('/api/members/merge'), admin.token)
    .send({ sourceId: '999999', targetId: 999999 });
  assert.strictEqual(sameArg.status, 400);

  // (b) target 上已有 w 的 self link;source 是 u 的本人成员(self link)
  const u = await makeUser(app, admin, 'mergeSelfC');
  const w = await makeUser(app, admin, 'mergeSelfC2');
  const tgt = await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '合并目标C', gender: '男', relationship: '父亲' });
  const bindW = await auth(request(app).post(`/api/members/${tgt.body.data.id}/links`), admin.token)
    .send({ granteeUserId: w.userId, role: 'self' });
  assert.strictEqual(bindW.status, 201);
  const meList = await auth(request(app).get('/api/members'), u.token);
  const selfMember = meList.body.data.find((m) => m.role === 'self');

  const merged = await auth(request(app).post('/api/members/merge'), admin.token)
    .send({ sourceId: selfMember.id, targetId: tgt.body.data.id });
  assert.strictEqual(merged.status, 200);

  const links = await auth(request(app).get(`/api/members/${tgt.body.data.id}/links`), admin.token);
  assert.strictEqual(links.status, 200);
  const selfLinks = links.body.data.filter((l) => l.role === 'self');
  assert.strictEqual(selfLinks.length, 1, 'target 仍只有一个 self link');
  assert.strictEqual(selfLinks[0].userId, w.userId, '保留 target 原有 self');
  const uLink = links.body.data.find((l) => l.userId === u.userId);
  assert.strictEqual(uLink.role, 'owner', 'source 的 self link 迁移时降级为 owner');
});

// Task 13 评审修正(升级分支):source 的 self link 用户在 target 已有低权 link,
// 但 target 已有他人 self link 时,升级止步于 owner,不产生第二个 self
test('merge:self 升级遇 target 已有他人 self 时降级为 owner', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'mrgUpU');
  const w = await makeUser(app, admin, 'mrgUpW');
  // target = w 的本人成员;w 授 u viewer
  const wList = await auth(request(app).get('/api/members'), w.token);
  const target = wList.body.data.find((m) => m.role === 'self');
  const grant = await auth(request(app).post(`/api/members/${target.id}/links`), w.token)
    .send({ granteeUserId: u.userId, role: 'viewer' });
  assert.strictEqual(grant.status, 201);
  // source = u 的本人成员(self link)
  const uList = await auth(request(app).get('/api/members'), u.token);
  const source = uList.body.data.find((m) => m.role === 'self');

  const merged = await auth(request(app).post('/api/members/merge'), admin.token)
    .send({ sourceId: source.id, targetId: target.id });
  assert.strictEqual(merged.status, 200);

  const links = await auth(request(app).get(`/api/members/${target.id}/links`), admin.token);
  assert.strictEqual(links.status, 200);
  const selfLinks = links.body.data.filter((l) => l.role === 'self');
  assert.strictEqual(selfLinks.length, 1, 'target 仍只有一个 self link');
  assert.strictEqual(selfLinks[0].userId, w.userId, 'self 归属 w');
  const uLink = links.body.data.find((l) => l.userId === u.userId);
  assert.strictEqual(uLink.role, 'owner', 'u 的升级止步于 owner');
  const srcGone = await auth(request(app).get(`/api/members/${source.id}`), u.token);
  assert.strictEqual(srcGone.status, 404);
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

// 控制器裁定:grantLink 的 relationship 与 create/update 同规,消毒后落库
test('grantLink 的 relationship 消毒后落库,缺省为 家人', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'sanOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '消毒对象', gender: '男', relationship: '父亲' });
  const mid = created.body.data.id;
  const v = await makeUser(app, admin, 'sanGrantee');
  const w = await makeUser(app, admin, 'sanGrantee2');

  const grant = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: v.userId, role: 'viewer', relationship: '张三&<b>李四</b>' });
  assert.strictEqual(grant.status, 201);
  assert.strictEqual(grant.body.data.relationship, '张三&amp;李四');

  const grantDefault = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: w.userId, role: 'viewer' });
  assert.strictEqual(grantDefault.status, 201);
  assert.strictEqual(grantDefault.body.data.relationship, '家人');

  const links = await auth(request(app).get(`/api/members/${mid}/links`), owner.token);
  const link = links.body.data.find((l) => l.userId === v.userId);
  assert.strictEqual(link.relationship, '张三&amp;李四');
});
