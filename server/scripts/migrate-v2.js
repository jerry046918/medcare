/**
 * v1 → v2 数据迁移
 * - users 加 role/displayName,既有用户全部设为 admin(单管理员时代只有 1 个)
 * - 建 user_member_links / invite_codes
 * - family_members(userId, relationship) 数据迁入 links 后放宽为可空(列保留,Task 13 --finalize 删除)
 * 幂等;文件库会在运行前自动备份。
 */
const fs = require('fs');
const path = require('path');

async function tableExists(sequelize, name) {
  const [rows] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = $name",
    { bind: { name } });
  return rows.length > 0;
}

async function migrateV2(sequelize) {
  if (await tableExists(sequelize, 'user_member_links')) {
    console.log('[migrate-v2] user_member_links 已存在,跳过(幂等)');
    return { skipped: true };
  }
  await sequelize.query("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
  await sequelize.query('ALTER TABLE users ADD COLUMN displayName TEXT');
  await sequelize.query("UPDATE users SET role = 'admin'"); // v1 唯一用户 → admin

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
  await sequelize.query('CREATE INDEX idx_uml_member ON user_member_links(memberId)');
  await sequelize.query('CREATE INDEX idx_uml_role ON user_member_links(role)');

  await sequelize.query(`CREATE TABLE invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    createdById INTEGER NOT NULL REFERENCES users(id),
    memberId INTEGER REFERENCES family_members(id),
    maxUses INTEGER NOT NULL DEFAULT 1,
    usedCount INTEGER NOT NULL DEFAULT 0,
    expiresAt DATETIME,
    active BOOLEAN NOT NULL DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // family_members → links(relationship='本人' → self,其余 owner)
  const [members] = await sequelize.query(
    'SELECT id, userId, relationship FROM family_members');
  for (const m of members) {
    const isSelf = m.relationship === '本人';
    // 每用户 self 唯一:若该用户已有 self,降级为 owner
    let role = isSelf ? 'self' : 'owner';
    if (isSelf) {
      const [existing] = await sequelize.query(
        'SELECT COUNT(*) as c FROM user_member_links WHERE userId = ? AND role = \'self\'',
        { replacements: [m.userId] });
      if (Number(existing[0].c) > 0) role = 'owner';
    }
    await sequelize.query(
      'INSERT INTO user_member_links (userId, memberId, role, relationship) VALUES (?, ?, ?, ?)',
      { replacements: [m.userId, m.id, role, m.relationship || '家人'] });
  }

  // 放宽 legacy 列(表重建:保留列、允许 NULL)
  await sequelize.query(`
    CREATE TABLE family_members_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      birthday DATEONLY,
      weight DECIMAL(5,2),
      height DECIMAL(5,2),
      userId INTEGER,
      relationship TEXT,
      createdAt DATETIME,
      updatedAt DATETIME
    )`);
  await sequelize.query(`
    INSERT INTO family_members_new (id, name, gender, birthday, weight, height, userId, relationship, createdAt, updatedAt)
    SELECT id, name, gender, birthday, weight, height, userId, relationship, createdAt, updatedAt FROM family_members`);
  // Sequelize 的 sqlite 连接默认 PRAGMA foreign_keys = ON,重建表期间需临时关闭
  await sequelize.query('PRAGMA foreign_keys = OFF');
  await sequelize.query('DROP TABLE family_members');
  await sequelize.query('ALTER TABLE family_members_new RENAME TO family_members');
  await sequelize.query('PRAGMA foreign_keys = ON');

  console.log(`[migrate-v2] 完成:迁移 ${members.length} 个成员的 links`);
  return { skipped: false, members: members.length };
}

// 删除 userId/relationship legacy 列（表重建;开发库经 --finalize 执行,Task 13 起启用）
async function finalizeV2(sequelize) {
  // 幂等判断:family_members 已无 userId 列即视为已 finalize
  const [cols] = await sequelize.query('PRAGMA table_info(family_members)');
  if (!cols.some((c) => c.name === 'userId')) return { skipped: true };
  await sequelize.query(`
    CREATE TABLE family_members_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      birthday DATEONLY,
      weight DECIMAL(5,2),
      height DECIMAL(5,2),
      createdAt DATETIME,
      updatedAt DATETIME
    )`);
  await sequelize.query(`
    INSERT INTO family_members_new (id, name, gender, birthday, weight, height, createdAt, updatedAt)
    SELECT id, name, gender, birthday, weight, height, createdAt, updatedAt FROM family_members`);
  await sequelize.query('PRAGMA foreign_keys = OFF');
  await sequelize.query('DROP TABLE family_members');
  await sequelize.query('ALTER TABLE family_members_new RENAME TO family_members');
  await sequelize.query('PRAGMA foreign_keys = ON');
  console.log('[migrate-v2] finalize 完成:已删除 legacy 列');
  return { skipped: false };
}

async function main() {
  require('dotenv').config();
  const { sequelize } = require('../src/models');
  const storage = sequelize.options.storage;
  if (storage && storage !== ':memory:' && fs.existsSync(storage)) {
    const backup = `${storage}.v1-backup-${Date.now()}`;
    fs.copyFileSync(storage, backup);
    console.log(`[migrate-v2] 已备份至 ${backup}`);
  }
  const finalize = process.argv.includes('--finalize');
  if (finalize) await finalizeV2(sequelize);
  else await migrateV2(sequelize);
  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { migrateV2, finalizeV2 };
