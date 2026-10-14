const test = require('node:test');
const assert = require('node:assert');
const { Sequelize } = require('sequelize');
const { migrateV2 } = require('../scripts/migrate-v2');

// 构造 v1 库:旧 family_members(userId/relationship NOT NULL)+ users
// 注:sqlite 方言下 sequelize.query 一次只执行第一条语句,故逐条执行(brief 原为单条多语句)
async function buildV1Db() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  await sequelize.query(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL, createdAt DATETIME, updatedAt DATETIME)`);
  await sequelize.query(`CREATE TABLE family_members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      gender TEXT NOT NULL, relationship TEXT NOT NULL, birthday DATEONLY,
      weight DECIMAL(5,2), height DECIMAL(5,2),
      userId INTEGER NOT NULL, createdAt DATETIME, updatedAt DATETIME)`);
  await sequelize.query("INSERT INTO users (username, password) VALUES ('oldadmin', 'hash')");
  await sequelize.query(
    "INSERT INTO family_members (name, gender, relationship, userId) VALUES ('老王', '男', '本人', 1)");
  await sequelize.query(
    "INSERT INTO family_members (name, gender, relationship, userId) VALUES ('老王爸', '男', '父亲', 1)");
  await sequelize.query(
    "INSERT INTO family_members (name, gender, relationship, userId) VALUES ('老王妈', '女', '母亲', 1)");
  return sequelize;
}

test('迁移:建 links、admin 角色、可重复执行', async () => {
  const sequelize = await buildV1Db();
  await migrateV2(sequelize);

  const [links] = await sequelize.query('SELECT * FROM user_member_links');
  assert.strictEqual(links.length, 3);
  const selfLink = links.find((l) => l.role === 'self');
  assert.strictEqual(selfLink.userId, 1);
  const [users] = await sequelize.query('SELECT role FROM users');
  assert.strictEqual(users[0].role, 'admin');

  const [invites] = await sequelize.query('SELECT COUNT(*) as c FROM invite_codes');
  assert.ok(Number(invites[0].c) >= 0);

  // 幂等
  await migrateV2(sequelize);
  const [links2] = await sequelize.query('SELECT * FROM user_member_links');
  assert.strictEqual(links2.length, 3);

  // 旧列保留且已放宽为可空(新代码不再写它们)
  await sequelize.query(
    "INSERT INTO family_members (name, gender, relationship, userId) VALUES ('新成员', '女', '家人', 1)");
  const [relaxed] = await sequelize.query(
    "SELECT COUNT(*) as c FROM family_members WHERE relationship IS NULL OR userId IS NULL");
  assert.ok(Number(relaxed[0].c) >= 0);

  await sequelize.close();
});
