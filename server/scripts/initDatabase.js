const { sequelize, MedicalIndicator, User } = require('../models');
const path = require('path');
const fs = require('fs');

// 检查命令行参数，是否强制重置
const forceReset = process.argv.includes('--force') || process.argv.includes('-f');

// 默认医疗指标数据
const defaultIndicators = [
  // 血液常规 - 数值型
  { 
    name: '白细胞计数', 
    unit: '10^9/L', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '3.5-9.5', 
    normalMin: 3.5, 
    normalMax: 9.5,
    isDefault: true 
  },
  { 
    name: '红细胞计数', 
    unit: '10^12/L', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '男:4.3-5.8, 女:3.8-5.1',
    isDefault: true 
  },
  { 
    name: '血红蛋白', 
    unit: 'g/L', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '男:130-175, 女:115-150',
    isDefault: true 
  },
  { 
    name: '血小板计数', 
    unit: '10^9/L', 
    type: '血液常规', 
    valueType: 'numeric',
    referenceRange: '125-350', 
    normalMin: 125, 
    normalMax: 350,
    isDefault: true 
  },
  
  // 生化检查 - 数值型
  { 
    name: '血糖', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '3.9-6.1', 
    normalMin: 3.9, 
    normalMax: 6.1,
    isDefault: true 
  },
  { 
    name: '总胆固醇', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '<5.18', 
    normalMin: 0, 
    normalMax: 5.18,
    isDefault: true 
  },
  { 
    name: '甘油三酯', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '<1.70', 
    normalMin: 0, 
    normalMax: 1.70,
    isDefault: true 
  },
  { 
    name: '高密度脂蛋白', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '男:>1.04, 女:>1.29',
    isDefault: true 
  },
  { 
    name: '低密度脂蛋白', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '<3.37', 
    normalMin: 0, 
    normalMax: 3.37,
    isDefault: true 
  },
  { 
    name: '尿酸', 
    unit: 'umol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '男:208-428, 女:155-357',
    isDefault: true 
  },
  { 
    name: '肌酐', 
    unit: 'umol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '男:57-111, 女:41-73',
    isDefault: true 
  },
  { 
    name: '尿素氮', 
    unit: 'mmol/L', 
    type: '生化检查', 
    valueType: 'numeric',
    referenceRange: '3.6-9.5', 
    normalMin: 3.6, 
    normalMax: 9.5,
    isDefault: true 
  },
  
  // 肝功能 - 数值型
  { 
    name: '丙氨酸氨基转移酶', 
    unit: 'U/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '男:9-50, 女:7-40',
    isDefault: true 
  },
  { 
    name: '天门冬氨酸氨基转移酶', 
    unit: 'U/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '男:15-40, 女:13-35',
    isDefault: true 
  },
  { 
    name: '总胆红素', 
    unit: 'umol/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '5.1-22.2', 
    normalMin: 5.1, 
    normalMax: 22.2,
    isDefault: true 
  },
  { 
    name: '直接胆红素', 
    unit: 'umol/L', 
    type: '肝功能', 
    valueType: 'numeric',
    referenceRange: '0-6.8', 
    normalMin: 0, 
    normalMax: 6.8,
    isDefault: true 
  },
  
  // 甲状腺功能 - 数值型
  { 
    name: '促甲状腺激素', 
    unit: 'mIU/L', 
    type: '甲状腺功能', 
    valueType: 'numeric',
    referenceRange: '0.27-4.2', 
    normalMin: 0.27, 
    normalMax: 4.2,
    isDefault: true 
  },
  { 
    name: '游离甲状腺素', 
    unit: 'pmol/L', 
    type: '甲状腺功能', 
    valueType: 'numeric',
    referenceRange: '12-22', 
    normalMin: 12, 
    normalMax: 22,
    isDefault: true 
  },
  { 
    name: '游离三碘甲状腺原氨酸', 
    unit: 'pmol/L', 
    type: '甲状腺功能', 
    valueType: 'numeric',
    referenceRange: '3.1-6.8', 
    normalMin: 3.1, 
    normalMax: 6.8,
    isDefault: true 
  },
  
  // 尿液检查 - 定性型（阴性为正常）
  { 
    name: '尿蛋白', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'qualitative',
    referenceRange: '阴性(-)', 
    normalValue: 'negative',
    isDefault: true 
  },
  { 
    name: '尿糖', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'qualitative',
    referenceRange: '阴性(-)', 
    normalValue: 'negative',
    isDefault: true 
  },
  { 
    name: '尿潜血', 
    unit: '', 
    type: '尿液检查', 
    valueType: 'qualitative',
    referenceRange: '阴性(-)', 
    normalValue: 'negative',
    isDefault: true 
  },
  
  // 心电图 - 数值型
  { 
    name: '心率', 
    unit: '次/分', 
    type: '心电图', 
    valueType: 'numeric',
    referenceRange: '60-100', 
    normalMin: 60, 
    normalMax: 100,
    isDefault: true 
  },
  
  // 血压 - 数值型
  { 
    name: '收缩压', 
    unit: 'mmHg', 
    type: '血压', 
    valueType: 'numeric',
    referenceRange: '<140', 
    normalMin: 90, 
    normalMax: 140,
    isDefault: true 
  },
  { 
    name: '舒张压', 
    unit: 'mmHg', 
    type: '血压', 
    valueType: 'numeric',
    referenceRange: '<90', 
    normalMin: 60, 
    normalMax: 90,
    isDefault: true 
  }
];

async function initDatabase() {
  try {
    console.log('开始初始化数据库...');
    
    // 确保数据库目录存在
    const dbDir = path.join(__dirname, '../database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('创建数据库目录:', dbDir);
    }
    
    // 确保上传目录存在
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('创建上传目录:', uploadsDir);
    }
    
    if (forceReset) {
      console.log('\n 强制重置模式：删除所有数据并重新创建...\n');
      
      // 删除数据库文件（如果存在）
      const dbPath = path.join(dbDir, 'medcare.db');
      if (fs.existsSync(dbPath)) {
        try {
          fs.unlinkSync(dbPath);
          console.log('已删除旧数据库文件');
        } catch (e) {
          console.log('无法删除数据库文件（可能被占用），尝试强制同步...');
        }
      }
    }
    
    // 同步数据库模型
    await sequelize.sync({ force: forceReset });
    console.log('数据库模型同步完成');
    
    if (forceReset) {
      // 强制模式下直接插入数据
      await MedicalIndicator.bulkCreate(defaultIndicators);
      console.log('成功插入 ' + defaultIndicators.length + ' 个默认医疗指标');
      
      await User.create({
        username: 'admin',
        password: '123456'
      });
      console.log('\n已创建默认管理员账户:');
      console.log('   用户名: admin');
      console.log('   密码: 123456');
      console.log('\n数据库已重置为初始状态！');
    } else {
      // 检查是否已有默认指标
      const existingIndicators = await MedicalIndicator.count({ where: { isDefault: true } });
      
      if (existingIndicators === 0) {
        await MedicalIndicator.bulkCreate(defaultIndicators);
        console.log('成功插入 ' + defaultIndicators.length + ' 个默认医疗指标');
      } else {
        console.log('数据库中已存在 ' + existingIndicators + ' 个默认指标，跳过插入');
      }
      
      // 创建默认测试账户
      const existingUserCount = await User.count();
      if (existingUserCount === 0) {
        await User.create({
          username: 'admin',
          password: '123456'
        });
        console.log('已创建默认管理员账户:');
        console.log('   用户名: admin');
        console.log('   密码: 123456');
      } else {
        console.log('数据库中已存在 ' + existingUserCount + ' 个用户，跳过创建默认账户');
      }
    }
    
    console.log('\n数据库初始化完成！');
    
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase().then(() => {
    process.exit(0);
  });
}

module.exports = { initDatabase };
