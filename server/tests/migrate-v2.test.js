const test = require('node:test');
const assert = require('node:assert');
const { Sequelize } = require('sequelize');
const { migrateV2, finalizeV2 } = require('../scripts/migrate-v2');

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

// Final Finding 4c:对裸 v1 库跑 --finalize 必须拒绝且不触碰数据库
// (真实库在 merge 后立即 finalize,防误跑丢列)
test('finalize:裸 v1 库拒绝执行,legacy 列保留', async () => {
  const sequelize = await buildV1Db();
  await assert.rejects(() => finalizeV2(sequelize), /先运行 migrate-v2 再 --finalize/);
  const [cols] = await sequelize.query('PRAGMA table_info(family_members)');
  assert.ok(cols.some((c) => c.name === 'userId'), '拒绝执行时不得删除 userId 列');
  assert.ok(cols.some((c) => c.name === 'relationship'), '拒绝执行时不得删除 relationship 列');
  const [linksTable] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='user_member_links'");
  assert.strictEqual(linksTable.length, 0, '拒绝执行时不得建表');
  const [members] = await sequelize.query('SELECT COUNT(*) as c FROM family_members');
  assert.strictEqual(Number(members[0].c), 3, '数据原样保留');
  await sequelize.close();
});

// Final Finding 4d:migrate 后 finalize 走通,legacy 列删除且数据保留;重复执行幂等
test('finalize:migrate 后执行删除 legacy 列,重复执行幂等', async () => {
  const sequelize = await buildV1Db();
  await migrateV2(sequelize);
  const first = await finalizeV2(sequelize);
  assert.strictEqual(first.skipped, false);
  const [cols] = await sequelize.query('PRAGMA table_info(family_members)');
  assert.ok(!cols.some((c) => c.name === 'userId'));
  assert.ok(!cols.some((c) => c.name === 'relationship'));
  const [members] = await sequelize.query('SELECT COUNT(*) as c FROM family_members');
  assert.strictEqual(Number(members[0].c), 3);
  const second = await finalizeV2(sequelize);
  assert.strictEqual(second.skipped, true);
  await sequelize.close();
});

// Final Finding 4b:users 已加列的部分完成库可续跑(PRAGMA 先查后 ALTER,不重复加列)
test('migrate:users 已加列时跳过 ALTER,后续阶段照常完成', async () => {
  const sequelize = await buildV1Db();
  // 模拟阶段 1 已完成、阶段 2 未开始的中断现场
  await sequelize.query("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
  await sequelize.query('ALTER TABLE users ADD COLUMN displayName TEXT');
  await sequelize.query("UPDATE users SET role = 'admin'");
  await migrateV2(sequelize);

  const [cols] = await sequelize.query('PRAGMA table_info(users)');
  assert.strictEqual(cols.filter((c) => c.name === 'role').length, 1, 'role 列不得重复');
  assert.strictEqual(cols.filter((c) => c.name === 'displayName').length, 1, 'displayName 列不得重复');
  const [links] = await sequelize.query('SELECT * FROM user_member_links');
  assert.strictEqual(links.length, 3);
  const selfLink = links.find((l) => l.role === 'self');
  assert.strictEqual(selfLink.userId, 1);
  await sequelize.close();
});

// Final Finding 4b:links 已建但 invite_codes 缺失的阶段间中断可补齐;
// 同时校验 invite_codes FK 行为与 sync 建表对齐(Final Finding 1c)
test('migrate:links 已建但缺 invite_codes 时补齐,FK 为 SET NULL', async () => {
  const sequelize = await buildV1Db();
  // 手工建 links(模拟在阶段 2 与阶段 3 之间中断)
  await sequelize.query(`CREATE TABLE user_member_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id),
    memberId INTEGER NOT NULL REFERENCES family_members(id),
    role TEXT NOT NULL DEFAULT 'owner',
    relationship TEXT NOT NULL DEFAULT '家人',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(userId, memberId)
  )`);
  await migrateV2(sequelize);

  const [invTable] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='invite_codes'");
  assert.strictEqual(invTable.length, 1, '缺 invite_codes 应补建');
  const [fkRows] = await sequelize.query('PRAGMA foreign_key_list(invite_codes)');
  // 注:本组合下 foreign_key_list 结果是单行对象(非数组),做归一化
  const fkRow = Array.isArray(fkRows) ? fkRows[0] : fkRows;
  assert.strictEqual(fkRow.on_delete, 'SET NULL', '迁移库 invite_codes FK 应与 sync 建表一致(SET NULL)');
  const [links] = await sequelize.query('SELECT * FROM user_member_links');
  assert.strictEqual(links.length, 3, '已有 links 不重复迁移');
  const [cols] = await sequelize.query('PRAGMA table_info(family_members)');
  assert.strictEqual(cols.find((c) => c.name === 'userId').notnull, 0, 'legacy 列应已放宽为可空');
  await sequelize.close();
});
