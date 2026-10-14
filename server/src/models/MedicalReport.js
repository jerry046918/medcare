const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MedicalReport = sequelize.define('MedicalReport', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    reportDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        notEmpty: true
      }
    },
    hospitalName: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    doctorName: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '报告附件文件路径'
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '原始文件名'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '报告备注'
    },
    memberId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'family_members',
        key: 'id'
      }
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
    tableName: 'medical_reports',
    indexes: [
      {
        fields: ['memberId']
      },
      {
        fields: ['reportDate']
      },
      {
        fields: ['hospitalName']
      }
    ]
  });

  return MedicalReport;
};