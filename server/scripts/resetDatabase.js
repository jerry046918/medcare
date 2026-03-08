/**
 * 重置数据库脚本
 * 用于清理所有测试数据，将系统恢复到初始状态
 */

const { sequelize, MedicalIndicator, User, FamilyMember, MedicalReport, ReportIndicatorData, MedicalLog } = require('../models');
const path = require('path');
const fs = require('fs');

async function resetDatabase() {
  try {
    console.log('===========================================');
    console.log('  重置数据库 - 将删除所有数据！');
    console.log('===========================================\n');
    
    // 确认操作
    console.log('正在清理所有数据...\n');
    
    // 按依赖顺序删除数据
    console.log('1. 删除报告指标数据...');
    await ReportIndicatorData.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('2. 删除医疗日志...');
    await MedicalLog.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('3. 删除医疗报告...');
    await MedicalReport.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('4. 删除家庭成员...');
    await FamilyMember.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('5. 删除用户创建的指标（非默认）...');
    await MedicalIndicator.destroy({ where: { isDefault: false }, truncate: false });
    
    console.log('6. 删除所有用户...');
    await User.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('\n✅ 所有数据已清理完成！\n');
    
    // 重新创建默认管理员账户
    console.log('正在创建默认管理员账户...');
    await User.create({
      username: 'admin',
      password: '123456'
    });
    
    console.log('\n===========================================');
    console.log('  数据库已重置为初始状态！');
    console.log('===========================================');
    console.log('\n默认登录信息:');
    console.log('  用户名: admin');
    console.log('  密码: 123456\n');
    console.log('请重新启动服务器后再访问系统。\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 重置数据库失败:', error.message);
    console.error('\n详细错误:', error);
    process.exit(1);
  }
}

// 执行重置
resetDatabase();
