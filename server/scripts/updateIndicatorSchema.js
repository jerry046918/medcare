const { sequelize, MedicalIndicator, ReportIndicatorData } = require('../models');

async function updateSchema() {
  try {
    console.log('开始更新数据库结构...');
    
    // 添加新字段到 medical_indicators 表
    try {
      await sequelize.query(`
        ALTER TABLE medical_indicators 
        ADD COLUMN valueType TEXT DEFAULT 'numeric' CHECK (valueType IN ('numeric', 'qualitative'))
      `);
      console.log('添加 valueType 字段成功');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('valueType 字段已存在');
      } else {
        console.log('添加 valueType 字段失败:', error.message);
      }
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE medical_indicators 
        ADD COLUMN normalMin DECIMAL(15,6)
      `);
      console.log('添加 normalMin 字段成功');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('normalMin 字段已存在');
      } else {
        console.log('添加 normalMin 字段失败:', error.message);
      }
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE medical_indicators 
        ADD COLUMN normalMax DECIMAL(15,6)
      `);
      console.log('添加 normalMax 字段成功');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('normalMax 字段已存在');
      } else {
        console.log('添加 normalMax 字段失败:', error.message);
      }
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE medical_indicators 
        ADD COLUMN normalValue TEXT CHECK (normalValue IN ('positive', 'negative'))
      `);
      console.log('添加 normalValue 字段成功');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('normalValue 字段已存在');
      } else {
        console.log('添加 normalValue 字段失败:', error.message);
      }
    }
    
    // 添加新字段到 report_indicator_data 表
    try {
      await sequelize.query(`
        ALTER TABLE report_indicator_data 
        ADD COLUMN abnormalType TEXT DEFAULT 'normal' CHECK (abnormalType IN ('normal', 'high', 'low', 'abnormal'))
      `);
      console.log('添加 abnormalType 字段成功');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('abnormalType 字段已存在');
      } else {
        console.log('添加 abnormalType 字段失败:', error.message);
      }
    }
    
    console.log('数据库结构更新完成');
    
    // 更新现有指标的默认值
    console.log('更新现有指标的默认值...');
    
    // 将所有现有指标设置为数值型
    await MedicalIndicator.update(
      { valueType: 'numeric' },
      { where: { valueType: null } }
    );
    
    // 更新现有报告指标数据的默认值
    await ReportIndicatorData.update(
      { abnormalType: 'normal' },
      { where: { abnormalType: null } }
    );
    
    console.log('默认值更新完成');
    
    // 显示一些示例数据
    const indicators = await MedicalIndicator.findAll({ limit: 5 });
    console.log('\n现有指标示例:');
    indicators.forEach(indicator => {
      console.log(`- ${indicator.name} (${indicator.valueType})`);
    });
    
    console.log('\n数据库更新完成！');
    
  } catch (error) {
    console.error('更新数据库结构失败:', error);
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateSchema();
}

module.exports = updateSchema;