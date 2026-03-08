/**
 * 数据库迁移脚本：添加 aliases 列到 medical_indicators 表
 * 
 * 运行方式：node scripts/addAliasesColumn.js
 */

const { sequelize } = require('../models');
const path = require('path');
const fs = require('fs');

async function addAliasesColumn() {
  try {
    console.log('开始添加 aliases 列...');

    // 检查数据库文件是否存在
    const dbPath = path.join(__dirname, '../database/medcare.db');
    if (!fs.existsSync(dbPath)) {
      console.log('数据库文件不存在，请先运行 initDatabase.js');
      process.exit(1);
    }

    // 检查列是否已存在
    const [results] = await sequelize.query(
      "PRAGMA table_info(medical_indicators)"
    );
    
    const aliasesExists = results.some(col => col.name === 'aliases');
    
    if (aliasesExists) {
      console.log('aliases 列已存在，无需迁移');
      return;
    }

    // 添加 aliases 列
    await sequelize.query(
      "ALTER TABLE medical_indicators ADD COLUMN aliases TEXT"
    );
    
    console.log('成功添加 aliases 列到 medical_indicators 表');

    // 为现有指标添加默认别名
    const defaultAliasMap = {
      '白细胞计数': ['白细胞', 'WBC', '白细胞数'],
      '红细胞计数': ['红细胞', 'RBC', '红细胞数'],
      '血红蛋白': ['HGB', '血红蛋白浓度', 'Hb'],
      '血小板计数': ['血小板', 'PLT', '血小板数'],
      '血糖': ['空腹血糖', 'Glu', '葡萄糖'],
      '尿酸': ['UA', '尿酸浓度'],
      '肌酐': ['Cr', '血肌酐'],
      '尿素氮': ['BUN'],
      '丙氨酸氨基转移酶': ['谷丙转氨酶', 'ALT'],
      '天门冬氨酸氨基转移酶': ['谷草转氨酶', 'AST'],
      '总胆固醇': ['TC', '胆固醇'],
      '甘油三酯': ['TG'],
      '高密度脂蛋白': ['HDL-C', 'HDL'],
      '低密度脂蛋白': ['LDL-C', 'LDL'],
      '总胆红素': ['TBIL'],
      '直接胆红素': ['DBIL'],
      '促甲状腺激素': ['TSH'],
      '游离甲状腺素': ['FT4'],
      '游离三碘甲状腺原氨酸': ['FT3']
    };

    let updatedCount = 0;
    for (const [name, aliases] of Object.entries(defaultAliasMap)) {
      const result = await sequelize.query(
        "UPDATE medical_indicators SET aliases = ? WHERE name = ? AND aliases IS NULL",
        {
          replacements: [JSON.stringify(aliases), name]
        }
      );
      if (result[1].changes > 0) {
        updatedCount++;
      }
    }

    console.log(`为 ${updatedCount} 个默认指标添加了初始别名`);

  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addAliasesColumn()
    .then(() => {
      console.log('迁移完成！');
      process.exit(0);
    })
    .catch(err => {
      console.error('迁移失败:', err);
      process.exit(1);
    });
}

module.exports = { addAliasesColumn };
