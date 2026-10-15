require('./helpers/app');
const test = require('node:test');
const assert = require('node:assert');
const { sequelize, User, FamilyMember, UserMemberLink } = require('../src/models');
const inviteService = require('../src/services/inviteService');
const HttpError = require('../src/utils/httpError');

async function seed() {
  await sequelize.sync({ force: true });
  const admin = await User.create({ username: 'admin', password: 'pass123456', role: 'admin' });
  const m = await FamilyMember.create({ name: '爸', gender: '男' });
  await UserMemberLink.create({ userId: admin.id, memberId: m.id, role: 'owner', relationship: '父亲' });
  return { admin, m };
}

test('生成与校验', async () => {
  const { admin } = await seed();
  const inv = await inviteService.createInvite({ createdById: admin.id });
  assert.match(inv.code, /^[A-Z2-9]{8}$/);
  const got = await inviteService.validateInvite(inv.code);
  assert.strictEqual(got.id, inv.id);
});

test('过期/停用/耗尽均拒绝', async () => {
  const { admin } = await seed();
  const expired = await inviteService.createInvite({
    createdById: admin.id, expiresAt: new Date(Date.now() - 86400000) });
  await assert.rejects(() => inviteService.validateInvite(expired.code),
    (e) => e instanceof HttpError && e.status === 400);

  const off = await inviteService.createInvite({ createdById: admin.id });
  await inviteService.deactivate(off.id);
  await assert.rejects(() => inviteService.validateInvite(off.code), (e) => e.status === 400);

  const one = await inviteService.createInvite({ createdById: admin.id });
  await inviteService.consumeInvite(one.code);
  await assert.rejects(() => inviteService.validateInvite(one.code), (e) => e.status === 400);
});

test('maxUses=2:第三次消费被拒(防超发)', async () => {
  const { admin } = await seed();
  const inv = await inviteService.createInvite({ createdById: admin.id, maxUses: 2 });
  await inviteService.consumeInvite(inv.code);
  await inviteService.consumeInvite(inv.code);
  await assert.rejects(() => inviteService.consumeInvite(inv.code), (e) => e.status === 400);
});

test('专属码绑定成员', async () => {
  const { admin, m } = await seed();
  const inv = await inviteService.createInvite({ createdById: admin.id, memberId: m.id });
  assert.strictEqual(inv.memberId, m.id);
});
