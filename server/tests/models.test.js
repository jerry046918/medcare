const test = require('node:test');
const assert = require('node:assert');
const { Sequelize } = require('sequelize');
const { buildModels } = require('../src/models');

async function freshDb() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const models = buildModels(sequelize);
  await sequelize.sync({ force: true });
  return { sequelize, models };
}

test('User.role 默认 member,可设 admin', async () => {
  const { models } = await freshDb();
  const u = await models.User.create({ username: 'user1', password: '123456' });
  assert.strictEqual(u.role, 'member');
  const a = await models.User.create({ username: 'user2', password: '123456', role: 'admin' });
  assert.strictEqual(a.role, 'admin');
});

test('UserMemberLink 唯一约束 (userId, memberId)', async () => {
  const { models, sequelize } = await freshDb();
  const u = await models.User.create({ username: 'user3', password: '123456' });
  const m = await models.FamilyMember.create({ name: 'A', gender: '男', relationship: '本人' });
  await models.UserMemberLink.create({ userId: u.id, memberId: m.id, role: 'owner', relationship: '父亲' });
  await assert.rejects(
    () => models.UserMemberLink.create({ userId: u.id, memberId: m.id, role: 'viewer' }),
    (e) => e.name === 'SequelizeUniqueConstraintError'
  );
});

test('InviteCode code 唯一且默认 maxUses=1/active=true', async () => {
  const { models } = await freshDb();
  const a = await models.User.create({ username: 'user4', password: '123456' });
  const i = await models.InviteCode.create({ code: 'ABCD2345', createdById: a.id });
  assert.strictEqual(i.maxUses, 1);
  assert.strictEqual(i.active, true);
  await assert.rejects(
    () => models.InviteCode.create({ code: 'ABCD2345', createdById: a.id }),
    (e) => e.name === 'SequelizeUniqueConstraintError'
  );
});
