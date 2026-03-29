const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ReportIndicatorData = sequelize.define('ReportIndicatorData', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: '指标值，存储为字符串以支持各种格式'
    },
    numericValue: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: true,
      comment: '数值型指标值，用于计算和图表显示'
    },
    referenceRange: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '该次检查的参考范围'
    },
    isNormal: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: '是否在正常范围内'
    },
    abnormalType: {
      type: DataTypes.ENUM('normal', 'high', 'low', 'abnormal'),
      allowNull: true,
      defaultValue: 'normal',
      comment: '异常类型：normal-正常，high-偏高，low-偏低，abnormal-异常'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '该指标的备注信息'
    },
    reportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'medical_reports',
        key: 'id'
      }
    },
    indicatorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'medical_indicators',
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
    tableName: 'report_indicator_data',
    indexes: [
      {
        fields: ['reportId']
      },
      {
        fields: ['indicatorId']
      },
      {
        fields: ['reportId', 'indicatorId'],
        unique: true
      }
    ],
    hooks: {
      beforeSave: async (instance) => {
        // 尝试将value转换为数值
        const numValue = parseFloat(instance.value);
        if (!isNaN(numValue)) {
          instance.numericValue = numValue;
        }

        // 自动判断是否正常（需要关联查询指标信息）
        if (instance.indicatorId) {
          const { MedicalIndicator, FamilyMember, MedicalReport } = require('./index');
          const indicator = await MedicalIndicator.findByPk(instance.indicatorId);

          if (indicator) {
            if (indicator.valueType === 'numeric') {
              // 数值型指标判断
              // 获取家庭成员的性别，以便选择合适的参考范围
              let min = indicator.normalMin;
              let max = indicator.normalMax;

              // 如果有关联的报告，获取家庭成员信息以判断性别
              if (instance.reportId) {
                const report = await MedicalReport.findByPk(instance.reportId);
                if (report && report.memberId) {
                  const familyMember = await FamilyMember.findByPk(report.memberId);
                  // 如果是女性且有女性专用参考范围，则使用女性范围
                  if (familyMember?.gender === '女' && indicator.normalMinFemale !== null) {
                    min = indicator.normalMinFemale;
                    max = indicator.normalMaxFemale;
                  }
                }
              }

              // 支持只有 min 或只有 max 的情况
              if (instance.numericValue !== null) {
                if (min !== null && instance.numericValue < min) {
                  instance.isNormal = false;
                  instance.abnormalType = 'low';
                } else if (max !== null && instance.numericValue > max) {
                  instance.isNormal = false;
                  instance.abnormalType = 'high';
                } else {
                  instance.isNormal = true;
                  instance.abnormalType = 'normal';
                }
              }
            } else if (indicator.valueType === 'qualitative') {
              // 定性指标判断
              // 前端传的 value 是 'positive' 或 'negative'
              // indicator.normalValue 也是 'positive' 或 'negative'
              if (indicator.normalValue) {
                const isNormal = instance.value === indicator.normalValue;

                instance.isNormal = isNormal;
                instance.abnormalType = isNormal ? 'normal' : 'abnormal';
              }
            }
          }
        }
      }
    }
  });

  return ReportIndicatorData;
};