const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InviteCode = sequelize.define('InviteCode', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(16), allowNull: false, unique: true },
    createdById: {
      type: DataTypes.INTEGER, allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    memberId: {
      type: DataTypes.INTEGER, allowNull: true,
      references: { model: 'family_members', key: 'id' }
    },
    maxUses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1, max: 100 } },
    usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    expiresAt: { type: DataTypes.DATE, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'invite_codes',
    indexes: [{ fields: ['code'] }, { fields: ['active'] }]
  });
  return InviteCode;
};
