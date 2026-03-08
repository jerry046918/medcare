const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Medication = sequelize.define('Medication', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 100],
        notEmpty: true
      },
      comment: '药品名称'
    },
    specification: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 50]
      },
      comment: '药品规格，如：10mg/片'
    },
    dosage: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 100]
      },
      comment: '剂量，如：每次1片'
    },
    frequency: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 100]
      },
      comment: '服用频率，如：每日3次'
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: '开始服药日期'
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: '结束服药日期'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '备注说明'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '是否正在服用'
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
    tableName: 'medications',
    indexes: [
      {
        fields: ['memberId']
      },
      {
        fields: ['name']
      },
      {
        fields: ['isActive']
      }
    ]
  });

  return Medication;
};
