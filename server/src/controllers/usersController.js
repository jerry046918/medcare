const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { User, UserMemberLink, FamilyMember } = require('../models');

// GET /api/users:登录即可;admin 视角多返回管理字段
exports.list = [authenticateToken, asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const users = await User.findAll({
    attributes: isAdmin
      ? ['id', 'username', 'displayName', 'role', 'createdAt']
      : ['id', 'username', 'displayName'],
    order: [['createdAt', 'ASC']]
  });
  let data = users.map((u) => u.toJSON());
  if (isAdmin) {
    const links = await UserMemberLink.findAll({
      where: { role: 'self' },
      include: [{ model: FamilyMember, as: 'member', attributes: ['id', 'name'] }]
    });
    const selfByUser = new Map(links.map((l) => [l.userId, l.member]));
    data = data.map((u) => ({ ...u, selfMember: selfByUser.get(u.id) || null }));
  }
  res.json({ success: true, data });
})];

// PUT /api/users/:id/role:仅 admin
exports.setRole = [requireAdmin, asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) throw new HttpError(400, '无效角色');
  const user = await User.findByPk(req.params.id);
  if (!user) throw new HttpError(404, '用户不存在');
  if (user.id === req.user.id) throw new HttpError(400, '不能修改自己的角色');
  await user.update({ role });
  res.json({ success: true, message: '角色已更新' });
})];
