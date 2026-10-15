/**
 * v1 → v2 数据迁移
 * - users 加 role/displayName,既有用户全部设为 admin(单管理员时代只有 1 个)
 * - 建 user_member_links / invite_codes
 * - family_members(userId, relationship) 数据迁入 links 后放宽为可空(列保留,Task 13 --finalize 删除)
 * 幂等(逐阶段可续跑);文件库会在运行前自动备份。
 * 硬化(Final Finding 4):各阶段包事务(SQLite 支持事务性 DDL;PRAGMA foreign_keys
 * 切换必须在事务外——事务内为 no-op),users.role 与各表存在性先查后建。
 */
const fs = require('fs');
const path = require('path');

async function tableExists(sequelize, name, options = {}) {
  const [rows] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = $name",
    { bind: { name }, ...options });
  return rows.length > 0;
}

// users 表是否已有某列(PRAGMA table_info,事务内可用)
async function columnExists(sequelize, table, column, options = {}) {
  const [cols] = await sequelize.query(`PRAGMA table_info(${table})`, options);
  return cols.some((c) => c.name === column);
}

// 表重建原子段。不能用 sequelize.transaction():文件库上它会按事务 uuid 另开新
// sqlite 连接,连接创建时执行 PRAGMA FOREIGN_KEYS=ON(connection-manager getConnection),
// 事务外切的 PRAGMA 到不了该连接,而 PRAGMA foreign_keys 在事务内又是 no-op。
// 因此在默认连接上手工 BEGIN/COMMIT:PRAGMA 切换与 DDL 全程同连接,PRAGMA 切换
// 仍处于事务边界之外(与 sqlite 语义一致)。
async function atomicRebuild(sequelize, statements) {
  await sequelize.query('PRAGMA foreign_keys = OFF');
  try {
    await sequelize.query('BEGIN DEFERRED TRANSACTION');
    for (const sql of statements) {
      await sequelize.query(sql);
    }
    await sequelize.query('COMMIT');
  } catch (error) {
    try { await sequelize.query('ROLLBACK'); } catch (e) { /* 事务可能已不存在 */ }
    throw error;
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON');
  }
}

async function migrateV2(sequelize) {
  // 快速幂等门:v2 两张表齐备才算迁移完成;只差其中一张(阶段间中断)时继续逐阶段补齐
  if ((await tableExists(sequelize, 'user_member_links'))
    && (await tableExists(sequelize, 'invite_codes'))) {
    console.log('[migrate-v2] v2 表已齐备,跳过(幂等)');
    return { skipped: true };
  }

  // 阶段 1:users 加 role/displayName(逐列 PRAGMA 检查,部分完成可续跑)
  await sequelize.transaction(async (t) => {
    if (!(await columnExists(sequelize, 'users', 'role', { transaction: t }))) {
      await sequelize.query(
        "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'", { transaction: t });
    }
    if (!(await columnExists(sequelize, 'users', 'displayName', { transaction: t }))) {
      await sequelize.query('ALTER TABLE users ADD COLUMN displayName TEXT', { transaction: t });
    }
    await sequelize.query("UPDATE users SET role = 'admin'", { transaction: t }); // v1 唯一用户 → admin
  });

  // 阶段 2:user_member_links(存在性单独检查)
  if (!(await tableExists(sequelize, 'user_member_links'))) {
    await sequelize.transaction(async (t) => {
      await sequelize.query(`CREATE TABLE user_member_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL REFERENCES users(id),
        memberId INTEGER NOT NULL REFERENCES family_members(id),
        role TEXT NOT NULL DEFAULT 'owner',
        relationship TEXT NOT NULL DEFAULT '家人',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(userId, memberId)
      )`, { transaction: t });
      await sequelize.query(
        'CREATE INDEX idx_uml_member ON user_member_links(memberId)', { transaction: t });
      await sequelize.query(
        'CREATE INDEX idx_uml_role ON user_member_links(role)', { transaction: t });
    });
  }

  // 阶段 3:invite_codes(存在性单独检查;memberId FK 与 sync 建表对齐为
  // ON DELETE SET NULL,消除迁移库/sync 库的 FK 行为漂移,Final Finding 1c)
  if (!(await tableExists(sequelize, 'invite_codes'))) {
    await sequelize.transaction(async (t) => {
      await sequelize.query(`CREATE TABLE invite_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        createdById INTEGER NOT NULL REFERENCES users(id),
        memberId INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
        maxUses INTEGER NOT NULL DEFAULT 1,
        usedCount INTEGER NOT NULL DEFAULT 0,
        expiresAt DATETIME,
        active BOOLEAN NOT NULL DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, { transaction: t });
    });
  }

  // 阶段 4:family_members → links(relationship='本人' → self,其余 owner);
  // 跳过已有 link 的 (userId, memberId),部分完成可续跑
  const [members] = await sequelize.query(
    'SELECT id, userId, relationship FROM family_members');
  let migrated = 0;
  await sequelize.transaction(async (t) => {
    for (const m of members) {
      const [existing] = await sequelize.query(
        'SELECT COUNT(*) as c FROM user_member_links WHERE userId = ? AND memberId = ?',
        { replacements: [m.userId, m.id], transaction: t });
      if (Number(existing[0].c) > 0) continue;
      const isSelf = m.relationship === '本人';
      // 每用户 self 唯一:若该用户已有 self,降级为 owner
      let role = isSelf ? 'self' : 'owner';
      if (isSelf) {
        const [selfRows] = await sequelize.query(
          'SELECT COUNT(*) as c FROM user_member_links WHERE userId = ? AND role = \'self\'',
          { replacements: [m.userId], transaction: t });
        if (Number(selfRows[0].c) > 0) role = 'owner';
      }
      await sequelize.query(
        'INSERT INTO user_member_links (userId, memberId, role, relationship) VALUES (?, ?, ?, ?)',
        { replacements: [m.userId, m.id, role, m.relationship || '家人'], transaction: t });
      migrated += 1;
    }
  });

  // 阶段 5:放宽 legacy 列(表重建:保留列、允许 NULL)。整段包事务保证原子:
  // 中途失败要么全做要么全不做,不会留下无名的 family_members_new。
  // 已放宽(userId 可空)或列已被 finalize 删除时跳过 → 重跑幂等
  const [fmCols] = await sequelize.query('PRAGMA table_info(family_members)');
  const userIdCol = fmCols.find((c) => c.name === 'userId');
  const relCol = fmCols.find((c) => c.name === 'relationship');
  const needsRebuild = !userIdCol || userIdCol.notnull === 1 || (!!relCol && relCol.notnull === 1);
  if (needsRebuild) {
    await atomicRebuild(sequelize, [
      `
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
        )`,
      `
        INSERT INTO family_members_new (id, name, gender, birthday, weight, height, userId, relationship, createdAt, updatedAt)
        SELECT id, name, gender, birthday, weight, height, userId, relationship, createdAt, updatedAt FROM family_members`,
      'DROP TABLE family_members',
      'ALTER TABLE family_members_new RENAME TO family_members'
    ]);
  }

  console.log(`[migrate-v2] 完成:迁移 ${migrated} 个成员的 links`);
  return { skipped: false, members: migrated };
}

// 删除 userId/relationship legacy 列（表重建;开发库经 --finalize 执行,Task 13 起启用）
async function finalizeV2(sequelize) {
  // 前置守卫(Final Finding 4c):v2 结构(link 表 + users.role)必须先就位,
  // 否则直接报错退出,不触碰数据库——防止对裸 v1 库误跑 --finalize 丢列
  if (!(await tableExists(sequelize, 'user_member_links'))) {
    throw new Error('[migrate-v2] user_member_links 表不存在:请先运行 migrate-v2 再 --finalize');
  }
  if (!(await columnExists(sequelize, 'users', 'role'))) {
    throw new Error('[migrate-v2] users.role 列不存在:请先运行 migrate-v2 再 --finalize');
  }
  // 幂等判断:family_members 已无 userId 列即视为已 finalize
  const [cols] = await sequelize.query('PRAGMA table_info(family_members)');
  if (!cols.some((c) => c.name === 'userId')) return { skipped: true };
  // 重建走默认连接手工事务(见 atomicRebuild 注释),PRAGMA 切换在事务边界外
  await atomicRebuild(sequelize, [
    `
      CREATE TABLE family_members_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        gender TEXT NOT NULL,
        birthday DATEONLY,
        weight DECIMAL(5,2),
        height DECIMAL(5,2),
        createdAt DATETIME,
        updatedAt DATETIME
      )`,
    `
      INSERT INTO family_members_new (id, name, gender, birthday, weight, height, createdAt, updatedAt)
      SELECT id, name, gender, birthday, weight, height, createdAt, updatedAt FROM family_members`,
    'DROP TABLE family_members',
    'ALTER TABLE family_members_new RENAME TO family_members'
  ]);
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
