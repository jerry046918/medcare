const { FamilyMember, MedicalReport, ReportIndicatorData, MedicalIndicator } = require('../models');
const HttpError = require('../utils/httpError');
const { sanitizeInput, escapeHtml, validateId, validateDate } = require('../utils/security');

/**
 * 消毒家庭成员数据
 */
function sanitizeMemberData(data) {
  const sanitized = { ...data };

  if (sanitized.name) {
    sanitized.name = escapeHtml(sanitizeInput(sanitized.name, { maxLength: 50 }));
  }
  if (sanitized.relationship) {
    sanitized.relationship = escapeHtml(sanitizeInput(sanitized.relationship, { maxLength: 20 }));
  }

  return sanitized;
}

// 获取所有家庭成员（含 age/bmi/reportCount 计算字段）
async function listByUser(userId) {
  const familyMembers = await FamilyMember.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    include: [{
      model: MedicalReport,
      as: 'reports',
      attributes: ['id', 'reportDate', 'hospitalName']
    }]
  });

  // 添加计算字段
  return familyMembers.map(member => {
    const memberData = member.toJSON();
    memberData.age = member.getAge();
    memberData.bmi = member.getBMI();
    memberData.reportCount = memberData.reports ? memberData.reports.length : 0;
    return memberData;
  });
}

// 获取单个家庭成员详情
async function getById(userId, id) {
  // 验证 ID
  const memberId = validateId(id);
  if (!memberId) {
    throw new HttpError(400, '无效的成员ID');
  }

  const familyMember = await FamilyMember.findOne({
    where: {
      id: memberId,
      userId
    },
    include: [{
      model: MedicalReport,
      as: 'reports',
      order: [['reportDate', 'DESC']],
      include: [{
        model: ReportIndicatorData,
        as: 'indicatorData',
        include: [{
          model: MedicalIndicator,
          as: 'indicator'
        }]
      }]
    }]
  });

  if (!familyMember) {
    throw new HttpError(404, '家庭成员不存在');
  }

  const memberData = familyMember.toJSON();
  memberData.age = familyMember.getAge();
  memberData.bmi = familyMember.getBMI();

  return memberData;
}

// 创建家庭成员
async function create(userId, data) {
  const { name, gender, relationship, birthday, weight, height } = data;

  // 消毒输入
  const sanitizedData = sanitizeMemberData({ name, relationship });

  // 验证必填字段
  if (!sanitizedData.name || !gender || !sanitizedData.relationship) {
    throw new HttpError(400, '姓名、性别和关系为必填字段');
  }

  // 验证性别
  const validGenders = ['男', '女', '其他'];
  if (!validGenders.includes(gender)) {
    throw new HttpError(400, '无效的性别值');
  }

  // 验证生日（如果提供）
  if (birthday && !validateDate(birthday)) {
    throw new HttpError(400, '无效的生日日期');
  }

  // 验证体重和身高（如果提供）
  const validatedWeight = weight !== undefined ? parseFloat(weight) : null;
  const validatedHeight = height !== undefined ? parseFloat(height) : null;

  if (validatedWeight !== null && (isNaN(validatedWeight) || validatedWeight <= 0 || validatedWeight > 500)) {
    throw new HttpError(400, '无效的体重值');
  }

  if (validatedHeight !== null && (isNaN(validatedHeight) || validatedHeight <= 0 || validatedHeight > 300)) {
    throw new HttpError(400, '无效的身高值');
  }

  const familyMember = await FamilyMember.create({
    name: sanitizedData.name,
    gender,
    relationship: sanitizedData.relationship,
    birthday: birthday || null,
    weight: validatedWeight,
    height: validatedHeight,
    userId
  });

  const memberData = familyMember.toJSON();
  memberData.age = familyMember.getAge();
  memberData.bmi = familyMember.getBMI();

  return memberData;
}

// 更新家庭成员
async function update(userId, id, data) {
  // 验证 ID
  const memberId = validateId(id);
  if (!memberId) {
    throw new HttpError(400, '无效的成员ID');
  }

  const { name, gender, relationship, birthday, weight, height } = data;

  const familyMember = await FamilyMember.findOne({
    where: {
      id: memberId,
      userId
    }
  });

  if (!familyMember) {
    throw new HttpError(404, '家庭成员不存在');
  }

  // 消毒输入
  const sanitizedData = sanitizeMemberData({ name, relationship });

  // 验证性别（如果提供）
  if (gender) {
    const validGenders = ['男', '女', '其他'];
    if (!validGenders.includes(gender)) {
      throw new HttpError(400, '无效的性别值');
    }
  }

  // 验证生日（如果提供）
  if (birthday !== undefined && birthday !== null && !validateDate(birthday)) {
    throw new HttpError(400, '无效的生日日期');
  }

  // 验证体重和身高（如果提供）
  const validatedWeight = weight !== undefined ? parseFloat(weight) : familyMember.weight;
  const validatedHeight = height !== undefined ? parseFloat(height) : familyMember.height;

  if (validatedWeight !== null && (isNaN(validatedWeight) || validatedWeight <= 0 || validatedWeight > 500)) {
    throw new HttpError(400, '无效的体重值');
  }

  if (validatedHeight !== null && (isNaN(validatedHeight) || validatedHeight <= 0 || validatedHeight > 300)) {
    throw new HttpError(400, '无效的身高值');
  }

  await familyMember.update({
    name: sanitizedData.name || familyMember.name,
    gender: gender || familyMember.gender,
    relationship: sanitizedData.relationship || familyMember.relationship,
    birthday: birthday !== undefined ? birthday : familyMember.birthday,
    weight: validatedWeight,
    height: validatedHeight
  });

  const memberData = familyMember.toJSON();
  memberData.age = familyMember.getAge();
  memberData.bmi = familyMember.getBMI();

  return memberData;
}

// 删除家庭成员
async function remove(userId, id) {
  // 验证 ID
  const memberId = validateId(id);
  if (!memberId) {
    throw new HttpError(400, '无效的成员ID');
  }

  const familyMember = await FamilyMember.findOne({
    where: {
      id: memberId,
      userId
    }
  });

  if (!familyMember) {
    throw new HttpError(404, '家庭成员不存在');
  }

  // 检查是否有关联的医疗报告
  const reportCount = await MedicalReport.count({
    where: { memberId: memberId }
  });

  if (reportCount > 0) {
    throw new HttpError(400, `无法删除该家庭成员，因为存在 ${reportCount} 份关联的医疗报告`);
  }

  await familyMember.destroy();
}

module.exports = { listByUser, getById, create, update, remove };
