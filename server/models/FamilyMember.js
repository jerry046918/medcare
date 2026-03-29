const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FamilyMember = sequelize.define('FamilyMember', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50],
        notEmpty: true
      }
    },
    gender: {
      type: DataTypes.ENUM('男', '女', '其他'),
      allowNull: false
    },
    relationship: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 20],
        notEmpty: true
      },
      comment: '与管理员的关系，如：本人、配偶、父亲、母亲、儿子、女儿等'
    },
    birthday: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true
      }
    },
    weight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 999.99
      },
      comment: '体重，单位：公斤'
    },
    height: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 999.99
      },
      comment: '身高，单位：厘米'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
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
    tableName: 'family_members',
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['name']
      }
    ]
  });

  // 实例方法：计算年龄
  FamilyMember.prototype.getAge = function() {
    if (!this.birthday) return null;
    const today = new Date();
    const birthDate = new Date(this.birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // 实例方法：计算BMI
  FamilyMember.prototype.getBMI = function() {
    if (!this.weight || !this.height) return null;
    const heightInMeters = this.height / 100;
    return parseFloat((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
  };

  return FamilyMember;
};