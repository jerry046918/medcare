const { User, FamilyMember, UserMemberLink } = require('../models');
const HttpError = require('../utils/httpError');

// 权限矩阵(规格 2.3):level → 允许的 link 角色;admin 恒通过
const LEVELS = {
  view: ['self', 'owner', 'editor', 'viewer'],
  edit: ['self', 'owner', 'editor'],          // 报告上传/编辑/删除
  manage: ['self', 'owner'],                  // 成员资料编辑/删除基线(删除另查 self link)
  grant: ['self', 'owner']                    // 授权他人
};

async function getMemberRole(userId, memberId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'role'] });
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  const link = await UserMemberLink.findOne({
    where: { userId, memberId },
    attributes: ['role']
  });
  return link ? link.role : null;
}

async function assertAccess(userId, memberId, level = 'view') {
  const member = await FamilyMember.findByPk(memberId, { attributes: ['id'] });
  if (!member) throw new HttpError(404, '成员不存在');
  const role = await getMemberRole(userId, memberId);
  if (!role) throw new HttpError(404, '成员不存在'); // 无可见性 → 与不存在同响应
  if (role === 'admin' || (LEVELS[level] || []).includes(role)) return role;
  throw new HttpError(403, '没有执行此操作的权限');
}

async function getVisibleMemberIds(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'role'] });
  if (!user) return [];
  if (user.role === 'admin') {
    const all = await FamilyMember.findAll({ attributes: ['id'] });
    return all.map((m) => m.id);
  }
  const links = await UserMemberLink.findAll({ where: { userId }, attributes: ['memberId'] });
  return links.map((l) => l.memberId);
}

async function listVisibleMembers(userId) {
  const ids = await getVisibleMemberIds(userId);
  if (ids.length === 0) return [];
  const members = await FamilyMember.findAll({ where: { id: ids } });
  const links = await UserMemberLink.findAll({ where: { userId, memberId: ids } });
  const linkByMember = new Map(links.map((l) => [l.memberId, l]));
  return members.map((m) => {
    const link = linkByMember.get(m.id);
    const data = m.toJSON();
    data.role = link ? link.role : 'admin';
    data.relationship = link ? link.relationship : null;
    data.age = m.getAge();
    data.bmi = m.getBMI();
    return data;
  });
}

async function getSelfMember(userId) {
  const link = await UserMemberLink.findOne({ where: { userId, role: 'self' } });
  if (!link) return null;
  return FamilyMember.findByPk(link.memberId);
}

module.exports = { getMemberRole, assertAccess, getVisibleMemberIds, listVisibleMembers, getSelfMember, LEVELS };
