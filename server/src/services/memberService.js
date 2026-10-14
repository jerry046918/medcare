const { FamilyMember, UserMemberLink, MedicalReport, ReportIndicatorData, MedicalIndicator, sequelize } = require('../models');
const accessService = require('./accessService');
const HttpError = require('../utils/httpError');
const { sanitizeInput, escapeHtml, validateId, validateDate } = require('../utils/security');

// v2：成员为全局资源，账户经 UserMemberLink（self/owner/editor/viewer）获得可见性与权限，
// 权限判定统一走 accessService 权限矩阵；legacy 列（family_members.userId/relationship）
// 过渡期保留，Task 13 切换 report/medication/log 服务后删除。

// 成员可见列表（accessService 矩阵）+ 每人 reportCount（与 v1 响应字段兼容）
async function listByUser(userId) {
  const members = await accessService.listVisibleMembers(userId);
  const counts = await MedicalReport.findAll({
    attributes: ['memberId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['memberId']
  });
  const countMap = new Map(counts.map((c) => [c.memberId, Number(c.get('count'))]));
  return members.map((m) => ({ ...m, reportCount: countMap.get(m.id) || 0 }));
}

// 单个成员详情（assertAccess view；reports/indicatorData include 形状沿用 v1）
async function getById(userId, id) {
  const memberId = validateId(id);
  if (!memberId) {
    throw new HttpError(400, '无效的成员ID');
  }

  await accessService.assertAccess(userId, memberId, 'view');

  const familyMember = await FamilyMember.findByPk(memberId, {
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
    throw new HttpError(404, '成员不存在');
  }

  const memberData = familyMember.toJSON();
  memberData.age = familyMember.getAge();
  memberData.bmi = familyMember.getBMI();

  return memberData;
}

// 创建全局成员 + 我的 owner link（relationship 存 link 上）
async function create(userId, body) {
  const { name, gender, relationship, birthday, weight, height } = body;

  const cleanName = escapeHtml(sanitizeInput(name, { maxLength: 50 }));
  const cleanRel = escapeHtml(sanitizeInput(relationship || '家人', { maxLength: 20 }));

  if (!cleanName) throw new HttpError(400, '姓名为必填字段');
  if (!['男', '女', '其他'].includes(gender)) throw new HttpError(400, '无效的性别值');
  if (birthday && !validateDate(birthday)) throw new HttpError(400, '无效的生日日期');

  // weight/height 校验沿用 v1 实现(0< w ≤500, 0< h ≤300)
  const validatedWeight = weight !== undefined ? parseFloat(weight) : null;
  const validatedHeight = height !== undefined ? parseFloat(height) : null;

  if (validatedWeight !== null && (isNaN(validatedWeight) || validatedWeight <= 0 || validatedWeight > 500)) {
    throw new HttpError(400, '无效的体重值');
  }

  if (validatedHeight !== null && (isNaN(validatedHeight) || validatedHeight <= 0 || validatedHeight > 300)) {
    throw new HttpError(400, '无效的身高值');
  }

  return sequelize.transaction(async (t) => {
    const member = await FamilyMember.create(
      {
        name: cleanName, gender, birthday: birthday || null,
        weight: validatedWeight, height: validatedHeight,
        // 过渡期写 legacy 列,Task 13 删除（reportService/medicationService/medicalLogService 仍按 FamilyMember.userId 过滤）
        userId, relationship: cleanRel
      },
      { transaction: t });
    await UserMemberLink.create(
      { userId, memberId: member.id, role: 'owner', relationship: cleanRel },
      { transaction: t });
    const data = member.toJSON();
    data.age = member.getAge();
    data.bmi = member.getBMI();
    data.role = 'owner';
    data.relationship = cleanRel;
    return data;
  });
}

// 编辑成员资料（manage 矩阵）；若带 relationship 且我的 role ∈ {self, owner} → 更新我的 link
async function update(userId, id, body) {
  const memberId = validateId(id);
  if (!memberId) {
    throw new HttpError(400, '无效的成员ID');
  }

  const role = await accessService.assertAccess(userId, memberId, 'manage');
  const member = await FamilyMember.findByPk(memberId);
  if (!member) throw new HttpError(404, '成员不存在');

  const { name, gender, relationship, birthday, weight, height } = body;
  const cleanName = name !== undefined ? escapeHtml(sanitizeInput(name, { maxLength: 50 })) : member.name;
  if (gender && !['男', '女', '其他'].includes(gender)) throw new HttpError(400, '无效的性别值');
  if (birthday !== undefined && birthday !== null && !validateDate(birthday)) throw new HttpError(400, '无效的生日日期');
  const w = weight !== undefined ? parseFloat(weight) : member.weight;
  const h = height !== undefined ? parseFloat(height) : member.height;
  if (w !== null && (isNaN(w) || w <= 0 || w > 500)) throw new HttpError(400, '无效的体重值');
  if (h !== null && (isNaN(h) || h <= 0 || h > 300)) throw new HttpError(400, '无效的身高值');

  await member.update({
    name: cleanName || member.name,
    gender: gender || member.gender,
    birthday: birthday !== undefined ? birthday : member.birthday,
    weight: w, height: h
  });

  // 视角关系：仅 self/owner 可改自己的 link.relationship
  if (relationship && (role === 'self' || role === 'owner')) {
    await UserMemberLink.update(
      { relationship: escapeHtml(sanitizeInput(relationship, { maxLength: 20 })) },
      { where: { userId, memberId } });
  }

  const data = member.toJSON();
  data.age = member.getAge();
  data.bmi = member.getBMI();
  return data;
}

// 删除成员：owner/admin 专属；已绑定账户（self link）→ 400 先拒；有报告 → 400；
// 删除时级联删 links + 成员（事务）
async function remove(userId, id) {
  const memberId = validateId(id);
  if (!memberId) {
    throw new HttpError(400, '无效的成员ID');
  }

  const member = await FamilyMember.findByPk(memberId);
  if (!member) throw new HttpError(404, '成员不存在');

  const role = await accessService.getMemberRole(userId, memberId);
  if (!role) throw new HttpError(404, '成员不存在'); // 无可见性 → 与不存在同响应

  // self link 判定先于角色门槛：本人/已绑定成员一律拒删（400 而非 403）
  const selfLink = await UserMemberLink.findOne({ where: { memberId, role: 'self' } });
  if (selfLink) throw new HttpError(400, '该成员已绑定账户，请先解绑');

  if (role !== 'owner' && role !== 'admin') throw new HttpError(403, '只有代管人或管理员可以删除成员');

  // 检查是否有关联的医疗报告（沿用 v1 文案）
  const reportCount = await MedicalReport.count({ where: { memberId } });
  if (reportCount > 0) {
    throw new HttpError(400, `无法删除该家庭成员，因为存在 ${reportCount} 份关联的医疗报告`);
  }

  await sequelize.transaction(async (t) => {
    await UserMemberLink.destroy({ where: { memberId }, transaction: t });
    await FamilyMember.destroy({ where: { id: memberId }, transaction: t });
  });
}

module.exports = { listByUser, getById, create, update, remove };
