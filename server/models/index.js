const { Sequelize } = require('sequelize');
const path = require('path');

// 创建SQLite数据库连接
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database/medcare.db'),
  logging: false, // 设置为 console.log 可以看到SQL查询
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
User.hasMany(FamilyMember, { foreignKey: 'userId', as: 'familyMembers' });

// 医疗报告属于家庭成员
MedicalReport.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'familyMember' });
FamilyMember.hasMany(MedicalReport, { foreignKey: 'memberId', as: 'reports' });

// 报告指标数据的关联
ReportIndicatorData.belongsTo(MedicalReport, { foreignKey: 'reportId', as: 'report' });
ReportIndicatorData.belongsTo(MedicalIndicator, { foreignKey: 'indicatorId', as: 'indicator' });
MedicalReport.hasMany(ReportIndicatorData, { foreignKey: 'reportId', as: 'indicatorData' });
MedicalIndicator.hasMany(ReportIndicatorData, { foreignKey: 'indicatorId', as: 'reportData' });

// 用药记录的关联
Medication.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'familyMember' });
FamilyMember.hasMany(Medication, { foreignKey: 'memberId', as: 'medications' });

// 医疗日志的关联
MedicalLog.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'familyMember' });
FamilyMember.hasMany(MedicalLog, { foreignKey: 'memberId', as: 'medicalLogs' });
MedicalLog.belongsTo(MedicalReport, { foreignKey: 'relatedReportId', as: 'relatedReport' });
MedicalLog.belongsTo(Medication, { foreignKey: 'relatedMedicationId', as: 'relatedMedication' });

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