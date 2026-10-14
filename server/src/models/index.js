const { Sequelize } = require('sequelize');
const { db: dbConfig } = require('../config');

// 模型工厂：测试/迁移用它构建隔离的 Sequelize 实例
function buildModels(sequelize) {
  const User = require('./User')(sequelize);
  const FamilyMember = require('./FamilyMember')(sequelize);
  const UserMemberLink = require('./UserMemberLink')(sequelize);
  const InviteCode = require('./InviteCode')(sequelize);
  const MedicalIndicator = require('./MedicalIndicator')(sequelize);
  const MedicalReport = require('./MedicalReport')(sequelize);
  const ReportIndicatorData = require('./ReportIndicatorData')(sequelize);
  const Medication = require('./Medication')(sequelize);
  const MedicalLog = require('./MedicalLog')(sequelize);
  const SystemConfig = require('./SystemConfig')(sequelize);

  // 用户-成员多对多（v2 新增）
  FamilyMember.belongsToMany(User, { through: UserMemberLink, foreignKey: 'memberId', otherKey: 'userId', as: 'linkedUsers' });
  User.belongsToMany(FamilyMember, { through: UserMemberLink, foreignKey: 'userId', otherKey: 'memberId', as: 'linkedMembers' });
  UserMemberLink.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  UserMemberLink.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'member' });

  // 邀请码（v2 新增）
  InviteCode.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });
  InviteCode.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'member' });
  User.hasMany(InviteCode, { foreignKey: 'createdById', as: 'createdInvites' });

  // 定义关联关系
  // （v2：成员归属与关系视角经 UserMemberLink，见上方 belongsToMany；旧 FamilyMember↔User 单外键关联已删除）

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

  return { User, FamilyMember, UserMemberLink, InviteCode, MedicalIndicator,
           MedicalReport, ReportIndicatorData, Medication, MedicalLog, SystemConfig };
}

// 创建SQLite数据库连接（应用单例，模块加载时创建一次）
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbConfig.storage,
  logging: dbConfig.logging, // 设置为 console.log 可以看到SQL查询
});

const models = buildModels(sequelize);

module.exports = { sequelize, buildModels, ...models };
