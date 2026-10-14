const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MedicalIndicator = sequelize.define('MedicalIndicator', {
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
      }
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 20]
      },
      comment: '指标单位，如：mg/dL、mmol/L等'
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50],
        notEmpty: true
      },
      comment: '指标类型，如：血液、尿液、生化等'
    },
    valueType: {
      type: DataTypes.ENUM('numeric', 'qualitative'),
      allowNull: false,
      defaultValue: 'numeric',
      comment: '值类型：numeric-数值型，qualitative-定性型（阴性/阳性）'
    },
    testMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 100]
      },
      comment: '测试方法'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '指标描述和备注'
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否为系统默认指标'
    },
    referenceRange: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '正常参考范围（文本描述）'
    },
    // 数值型指标的正常范围
    normalMin: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: true,
      comment: '数值型指标的最小正常值'
    },
    normalMax: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: true,
      comment: '数值型指标的最大正常值（通用/男性）'
    },
    // 性别特定参考范围（女性专用，可选）
    normalMinFemale: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: true,
      comment: '女性专用最小正常值（如与通用值不同时填写）'
    },
    normalMaxFemale: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: true,
      comment: '女性专用最大正常值（如与通用值不同时填写）'
    },
    // 定性指标的正常值
    normalValue: {
      type: DataTypes.ENUM('positive', 'negative'),
      allowNull: true,
      comment: '定性指标的正常值：positive-阳性，negative-阴性'
    },
    // 指标别名（用于OCR识别匹配）
    aliases: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '指标别名JSON数组，用于OCR识别时自动匹配',
      get() {
        const raw = this.getDataValue('aliases');
        if (!raw) return [];
        try {
          return JSON.parse(raw);
        } catch {
          return [];
        }
      },
      set(value) {
        this.setDataValue('aliases', JSON.stringify(value || []));
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
    tableName: 'medical_indicators',
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['type']
      },
      {
        fields: ['isDefault']
      }
    ]
  });

  return MedicalIndicator;
};