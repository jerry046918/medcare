const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MedicalLog = sequelize.define('MedicalLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    memberId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'family_members',
        key: 'id'
      }
    },
    // 日志类型: report(报告), medication(用药), hospitalization(住院), outpatient(门诊), emergency(急诊)
    logType: {
      type: DataTypes.ENUM('report', 'medication', 'hospitalization', 'outpatient', 'emergency'),
      allowNull: false
    },
    // 标题/简要描述
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // 详细描述
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // 就诊医院（手动行为可用）
    hospital: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // 治疗开始时间（用于排序）
    treatmentStartDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // 治疗结束时间（手动行为可用）
    treatmentEndDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // 关联的报告ID（如果是报告类型）
    relatedReportId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // 关联的用药ID（如果是用药类型）
    relatedMedicationId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // 日志日期（保留用于显示，不再用于排序）
    logDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'medical_logs',
    indexes: [
      {
        fields: ['memberId']
      },
      {
        fields: ['logType']
      },
      {
        fields: ['treatmentStartDate']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return MedicalLog
};
