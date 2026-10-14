const { Sequelize } = require('sequelize');
const path = require('path');
const { db: dbConfig } = require('../config');

// 创建SQLite数据库连接
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbConfig.storage,
  logging: dbConfig.logging, // 设置为 console.log 可以看到SQL查询
});

// 导入模型
const User = require('./User')(sequelize);
const FamilyMember = require('./FamilyMember')(sequelize);
const MedicalIndicator = require('./MedicalIndicator')(sequelize);
const MedicalReport = require('./MedicalReport')(sequelize);
const ReportIndicatorData = require('./ReportIndicatorData')(sequelize);
const Medication = require('./Medication')(sequelize);
const MedicalLog = require('./MedicalLog')(sequelize);
const SystemConfig = require('./SystemConfig')(sequelize);

// 定义关联关系
// 家庭成员属于用户
FamilyMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(FamilyMember, {
  foreignKey: 'userId',
  as: 'familyMembers',
  onDelete: 'CASCADE' // 删除用户时级联删除家庭成员
});

// 医疗报告属于家庭成员
MedicalReport.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'familyMember' });
FamilyMember.hasMany(MedicalReport, {
  foreignKey: 'memberId',
  as: 'reports',
  onDelete: 'CASCADE' // 删除家庭成员时级联删除报告
});

// 报告指标数据的关联
ReportIndicatorData.belongsTo(MedicalReport, { foreignKey: 'reportId', as: 'report' });
ReportIndicatorData.belongsTo(MedicalIndicator, { foreignKey: 'indicatorId', as: 'indicator' });
MedicalReport.hasMany(ReportIndicatorData, {
  foreignKey: 'reportId',
  as: 'indicatorData',
  onDelete: 'CASCADE' // 删除报告时级联删除指标数据
});
MedicalIndicator.hasMany(ReportIndicatorData, {
  foreignKey: 'indicatorId',
  as: 'reportData',
  onDelete: 'SET NULL' // 删除指标时将关联的指标数据设为 NULL
});

// 用药记录的关联
Medication.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'familyMember' });
FamilyMember.hasMany(Medication, {
  foreignKey: 'memberId',
  as: 'medications',
  onDelete: 'CASCADE' // 删除家庭成员时级联删除用药记录
});

// 医疗日志的关联
MedicalLog.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'familyMember' });
FamilyMember.hasMany(MedicalLog, {
  foreignKey: 'memberId',
  as: 'medicalLogs',
  onDelete: 'CASCADE' // 删除家庭成员时级联删除医疗日志
});
MedicalLog.belongsTo(MedicalReport, {
  foreignKey: 'relatedReportId',
  as: 'relatedReport',
  onDelete: 'SET NULL' // 删除报告时将关联日志的 reportId 设为 NULL
});
MedicalLog.belongsTo(Medication, {
  foreignKey: 'relatedMedicationId',
  as: 'relatedMedication',
  onDelete: 'SET NULL' // 删除用药记录时将关联日志的 medicationId 设为 NULL
});

module.exports = {
  sequelize,
  User,
  FamilyMember,
  MedicalIndicator,
  MedicalReport,
  ReportIndicatorData,
  Medication,
  MedicalLog,
  SystemConfig
};
