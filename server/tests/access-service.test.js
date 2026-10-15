require('./helpers/app'); // 确保 NODE_ENV/MEDCARE_DB_PATH 环境变量就位
const test = require('node:test');
const assert = require('node:assert');
const { sequelize, User, FamilyMember, UserMemberLink } = require('../src/models');
const accessService = require('../src/services/accessService');

async function seed() {
  await sequelize.sync({ force: true });
  const admin = await User.create({ username: 'admin', password: 'pass123456', role: 'admin' });
  const alice = await User.create({ username: 'alice', password: 'pass123456' });
  const bob = await User.create({ username: 'bob', password: 'pass123456' });
  const carol = await User.create({ username: 'carol', password: 'pass123456' });
  // family_members 已无 relationship 列（v2），视角关系只存于 UserMemberLink
  const dad = await FamilyMember.create({ name: '爸', gender: '男' });
  // alice: self(爸是她本人);bob: owner(代管);carol: viewer;editor 用户:
  const dave = await User.create({ username: 'dave', password: 'pass123456' });
  await UserMemberLink.bulkCreate([
    { userId: alice.id, memberId: dad.id, role: 'self', relationship: '本人' },
    { userId: bob.id, memberId: dad.id, role: 'owner', relationship: '父亲' },
    { userId: carol.id, memberId: dad.id, role: 'viewer', relationship: '家人' },
    { userId: dave.id, memberId: dad.id, role: 'editor', relationship: '家人' }
  ]);
  return { admin, alice, bob, carol, dave, dad };
}

async function allows(userId, memberId, level) {
  try { await accessService.assertAccess(userId, memberId, level); return true; }
  catch { return false; }
}

test('权限矩阵:4 角色 × view/edit/manage/grant', async () => {
  const { admin, alice, bob, carol, dave, dad } = await seed();
  // view: 全部允许
  for (const u of [admin, alice, bob, carol, dave]) {
    assert.ok(await allows(u.id, dad.id, 'view'), `${u.username} 应可 view`);
  }
  // edit: self/owner/editor/admin
  assert.ok(await allows(alice.id, dad.id, 'edit'));
  assert.ok(await allows(bob.id, dad.id, 'edit'));
  assert.ok(await allows(dave.id, dad.id, 'edit'));
  assert.ok(await allows(admin.id, dad.id, 'edit'));
  assert.ok(!(await allows(carol.id, dad.id, 'edit')), 'viewer 不可 edit');
  // manage(编辑成员资料): self/owner/admin
  assert.ok(await allows(alice.id, dad.id, 'manage'));
  assert.ok(await allows(bob.id, dad.id, 'manage'));
  assert.ok(await allows(admin.id, dad.id, 'manage'));
  assert.ok(!(await allows(dave.id, dad.id, 'manage')), 'editor 不可 manage');
  assert.ok(!(await allows(carol.id, dad.id, 'manage')), 'viewer 不可 manage');
  // grant(授权): self/owner/admin
  assert.ok(await allows(alice.id, dad.id, 'grant'));
  assert.ok(await allows(bob.id, dad.id, 'grant'));
  assert.ok(await allows(admin.id, dad.id, 'grant'));
  assert.ok(!(await allows(dave.id, dad.id, 'grant')), 'editor 不可 grant');
});

test('无 link 的普通用户 → 404(不泄露存在性)', async () => {
  const { alice, dad } = await seed();
  const stranger = await User.create({ username: 'stranger', password: 'pass123456' });
  await assert.rejects(
    () => accessService.assertAccess(stranger.id, dad.id, 'view'),
    (e) => e.status === 404
  );
  assert.strictEqual(await accessService.getMemberRole(stranger.id, dad.id), null);
  assert.ok(alice); // 引用保持
});

test('getVisibleMemberIds / listVisibleMembers / getSelfMember', async () => {
  const { admin, alice, carol, dad } = await seed();
  const stranger = await User.create({ username: 'stranger2', password: 'pass123456' });
  const ids = await accessService.getVisibleMemberIds(carol.id);
  assert.deepStrictEqual(ids.sort(), [dad.id].sort());
  const all = await accessService.getVisibleMemberIds(admin.id);
  assert.ok(all.includes(dad.id));
  const list = await accessService.listVisibleMembers(carol.id);
  assert.strictEqual(list[0].role, 'viewer');
  assert.strictEqual(list[0].name, '爸');
  const self = await accessService.getSelfMember(alice.id);
  assert.strictEqual(self.id, dad.id);
  assert.strictEqual(await accessService.getSelfMember(stranger.id), null);
});

test('不存在/无效 memberId', async () => {
  const { alice } = await seed();
  await assert.rejects(
    () => accessService.assertAccess(alice.id, 99999, 'view'),
    (e) => e.status === 404
  );
});
