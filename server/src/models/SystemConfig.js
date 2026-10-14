const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SystemConfig = sequelize.define('SystemConfig', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    configKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [1, 100],
        notEmpty: true
      },
      comment: '配置键名'
    },
    configValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '配置值（JSON格式存储复杂配置）'
    },
    configType: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
      allowNull: false,
      defaultValue: 'string',
      comment: '配置值类型'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'general',
      comment: '配置分类：ocr, general, storage 等'
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '配置项描述'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否公开给前端（敏感配置不应公开）'
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
    tableName: 'system_configs',
    indexes: [
      {
        unique: true,
        fields: ['configKey']
      },
      {
        fields: ['category']
      }
    ]
  });

  return SystemConfig;
};
