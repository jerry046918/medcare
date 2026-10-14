const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserMemberLink = sequelize.define('UserMemberLink', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER, allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    memberId: {
      type: DataTypes.INTEGER, allowNull: false,
      references: { model: 'family_members', key: 'id' }
    },
    role: {
      type: DataTypes.ENUM('self', 'owner', 'editor', 'viewer'),
      allowNull: false,
      defaultValue: 'owner'
    },
    relationship: {
      type: DataTypes.STRING(20), allowNull: false, defaultValue: '家人',
      comment: '当前账户视角下的关系称谓'
    },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'user_member_links',
    indexes: [
      { unique: true, fields: ['userId', 'memberId'] },
      { fields: ['memberId'] },
      { fields: ['role'] }
    ]
  });
  return UserMemberLink;
};
