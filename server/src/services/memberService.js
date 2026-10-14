const { FamilyMember, UserMemberLink, User, MedicalReport, ReportIndicatorData, MedicalIndicator, Medication, MedicalLog, sequelize } = require('../models');
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

// ===== 授权(links)与合并(merge) =====

// 角色权重:合并 links 冲突时取高者
const ROLE_RANK = { self: 4, owner: 3, editor: 2, viewer: 1 };

// 成员的授权列表(self/owner/admin 可见)
async function listLinks(userId, memberId) {
  const id = validateId(memberId);
  if (!id) throw new HttpError(400, '无效的成员ID');
  await accessService.assertAccess(userId, id, 'grant');
  const links = await UserMemberLink.findAll({
    where: { memberId: id },
    include: [{ association: 'user', attributes: ['id', 'username', 'displayName'] }],
    order: [['createdAt', 'ASC']]
  });
  return links.map((l) => ({
    id: l.id, userId: l.userId, username: l.user?.username, displayName: l.user?.displayName,
    role: l.role, relationship: l.relationship, createdAt: l.createdAt
  }));
}

// 授权:self/owner 仅可授 viewer/editor;admin 另可授 owner 及 self(仅当成员无 self link)
async function grantLink(userId, memberId, { granteeUserId, role, relationship = '家人' }) {
  const id = validateId(memberId);
  if (!id) throw new HttpError(400, '无效的成员ID');
  const myRole = await accessService.assertAccess(userId, id, 'grant');
  if (!['viewer', 'editor', 'owner', 'self'].includes(role)) throw new HttpError(400, '无效的授权角色');
  const isOwnerOrSelf = myRole === 'self' || myRole === 'owner';
  if (isOwnerOrSelf && !['viewer', 'editor'].includes(role)) {
    throw new HttpError(403, '只有管理员可以授予该角色');
  }
  const grantee = await User.findByPk(granteeUserId);
  if (!grantee) throw new HttpError(400, '目标用户不存在');
  if (role === 'self') {
    const claimed = await UserMemberLink.findOne({ where: { memberId: id, role: 'self' } });
    if (claimed) throw new HttpError(409, '该成员已绑定账户');
  }
  const existing = await UserMemberLink.findOne({ where: { userId: granteeUserId, memberId: id } });
  if (existing) throw new HttpError(409, '该用户已有此成员的授权');
  // relationship 与 create/update 同规:消毒后再落库(控制器裁定,偏离 brief 原文)
  const cleanRel = escapeHtml(sanitizeInput(relationship, { maxLength: 20 }));
  return UserMemberLink.create({ userId: granteeUserId, memberId: id, role, relationship: cleanRel });
}

// 撤销授权;role='self' 的 link 仅 admin 可删(解绑需管理员)
async function revokeLink(userId, memberId, linkId) {
  const id = validateId(memberId);
  if (!id) throw new HttpError(400, '无效的成员ID');
  await accessService.assertAccess(userId, id, 'grant');
  const link = await UserMemberLink.findOne({ where: { id: linkId, memberId: id } });
  if (!link) throw new HttpError(404, '授权记录不存在');
  const user = await User.findByPk(userId, { attributes: ['role'] });
  if (link.role === 'self' && user.role !== 'admin') {
    throw new HttpError(403, '本人绑定只能由管理员解除');
  }
  await link.destroy();
}

// 合并成员(admin):迁移 reports/medications/medicalLogs 与 links 后删除 source,单事务
async function merge(userId, { sourceId, targetId }) {
  const user = await User.findByPk(userId, { attributes: ['role'] });
  if (user.role !== 'admin') throw new HttpError(403, '只有管理员可以合并成员');
  if (!sourceId || !targetId || sourceId === targetId) throw new HttpError(400, '无效的合并参数');
  const source = await FamilyMember.findByPk(sourceId);
  const target = await FamilyMember.findByPk(targetId);
  if (!source || !target) throw new HttpError(404, '成员不存在');

  await sequelize.transaction(async (t) => {
    await MedicalReport.update({ memberId: targetId }, { where: { memberId: sourceId }, transaction: t });
    await Medication.update({ memberId: targetId }, { where: { memberId: sourceId }, transaction: t });
    await MedicalLog.update({ memberId: targetId }, { where: { memberId: sourceId }, transaction: t });

    const links = await UserMemberLink.findAll({ where: { memberId: sourceId }, transaction: t });
    for (const link of links) {
      const existing = await UserMemberLink.findOne({
        where: { memberId: targetId, userId: link.userId }, transaction: t });
      if (!existing) {
        await UserMemberLink.create(
          { userId: link.userId, memberId: targetId, role: link.role, relationship: link.relationship },
          { transaction: t });
      } else if (link.role === 'self') {
        // source 的 self link 用户:其在 target 上的低权 link 升为 self(同用户同成员唯一,原地更新);
        // 若其在 target 已是 self 则保留现状,不动
        if (existing.role !== 'self') {
          await existing.update({ role: 'self', relationship: link.relationship }, { transaction: t });
        }
      } else if (ROLE_RANK[link.role] > ROLE_RANK[existing.role] && existing.role !== 'self') {
        await existing.update({ role: link.role, relationship: link.relationship }, { transaction: t });
      }
      await link.destroy({ transaction: t });
    }
    await source.destroy({ transaction: t });
  });
}

module.exports = { listByUser, getById, create, update, remove, listLinks, grantLink, revokeLink, merge };
