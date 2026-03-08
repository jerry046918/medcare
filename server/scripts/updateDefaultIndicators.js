const { sequelize, MedicalIndicator } = require('../models');

// 更新默认指标的完整数据
const updatedIndicators = [
  // 血液常规 - 数值型
  { name: '白细胞计数', valueType: 'numeric', normalMin: 3.5, normalMax: 9.5 },
  { name: '红细胞计数', valueType: 'numeric', normalMin: 3.8, normalMax: 5.8 }, // 取男女范围的综合值
  { name: '血红蛋白', valueType: 'numeric', normalMin: 115, normalMax: 175 }, // 取男女范围的综合值
  { name: '血小板计数', valueType: 'numeric', normalMin: 125, normalMax: 350 },
  
  // 生化检查 - 数值型
  { name: '血糖', valueType: 'numeric', normalMin: 3.9, normalMax: 6.1 },
  { name: '总胆固醇', valueType: 'numeric', normalMin: 0, normalMax: 5.18 },
  { name: '甘油三酯', valueType: 'numeric', normalMin: 0, normalMax: 1.70 },
  { name: '高密度脂蛋白', valueType: 'numeric', normalMin: 1.04, normalMax: 999 }, // 设置一个较大的上限
  { name: '低密度脂蛋白', valueType: 'numeric', normalMin: 0, normalMax: 3.37 },
  { name: '尿酸', valueType: 'numeric', normalMin: 155, normalMax: 428 }, // 取男女范围的综合值
  { name: '肌酐', valueType: 'numeric', normalMin: 41, normalMax: 111 }, // 取男女范围的综合值
  { name: '尿素氮', valueType: 'numeric', normalMin: 3.6, normalMax: 9.5 },
  
  // 肝功能 - 数值型
  { name: '丙氨酸氨基转移酶', valueType: 'numeric', normalMin: 7, normalMax: 50 }, // 取男女范围的综合值
  { name: '天门冬氨酸氨基转移酶', valueType: 'numeric', normalMin: 13, normalMax: 40 }, // 取男女范围的综合值
  { name: '总胆红素', valueType: 'numeric', normalMin: 5.1, normalMax: 22.2 },
  { name: '直接胆红素', valueType: 'numeric', normalMin: 0, normalMax: 6.8 },
  
  // 甲状腺功能 - 数值型
  { name: '促甲状腺激素', valueType: 'numeric', normalMin: 0.27, normalMax: 4.2 },
  { name: '游离甲状腺素', valueType: 'numeric', normalMin: 12, normalMax: 22 },
  { name: '游离三碘甲状腺原氨酸', valueType: 'numeric', normalMin: 3.1, normalMax: 6.8 },
  
  // 尿液检查 - 定性型
  { name: '尿蛋白', valueType: 'qualitative', normalValue: 'negative' },
  { name: '尿糖', valueType: 'qualitative', normalValue: 'negative' },
  { name: '尿潜血', valueType: 'qualitative', normalValue: 'negative' },
  
  // 心电图 - 数值型
  { name: '心率', valueType: 'numeric', normalMin: 60, normalMax: 100 },
  
  // 血压 - 数值型
  { name: '收缩压', valueType: 'numeric', normalMin: 90, normalMax: 139 }, // 正常血压范围
  { name: '舒张压', valueType: 'numeric', normalMin: 60, normalMax: 89 } // 正常血压范围
];

async function updateDefaultIndicators() {
  try {
    console.log('开始更新默认指标...');
    
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    let updatedCount = 0;
    
    for (const indicatorData of updatedIndicators) {
      const indicator = await MedicalIndicator.findOne({
        where: { 
          name: indicatorData.name,
          isDefault: true 
        }
      });
      
      if (indicator) {
        await indicator.update({
          valueType: indicatorData.valueType,
          normalMin: indicatorData.normalMin || null,
          normalMax: indicatorData.normalMax || null,
          normalValue: indicatorData.normalValue || null
        });
        updatedCount++;
        console.log(`✓ 更新指标: ${indicatorData.name} (${indicatorData.valueType})`);
      } else {
        console.log(`⚠ 未找到指标: ${indicatorData.name}`);
      }
    }
    
    console.log(`\n更新完成！共更新了 ${updatedCount} 个默认指标`);
    console.log('所有默认指标现在都有完整的值类型和正常值范围信息');
    
  } catch (error) {
    console.error('更新默认指标失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateDefaultIndicators().then(() => {
    process.exit(0);
  });
}

module.exports = { updateDefaultIndicators };