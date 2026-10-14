const asyncHandler = require('../utils/asyncHandler');
const inviteService = require('../services/inviteService');

// 以下端点均挂 requireAdmin（见 routes/invites.js）

exports.list = asyncHandler(async (req, res) => {
  const data = await inviteService.listInvites(); // 含 createdBy/member/usage
  res.json({ success: true, data });
});

// body: { memberId?, maxUses?, expiresDays? } —— expiresAt 由 expiresDays 换算
exports.create = asyncHandler(async (req, res) => {
  const { memberId, maxUses, expiresDays } = req.body;
  const data = await inviteService.createInvite({
    createdById: req.user.id,
    memberId: memberId || null,
    maxUses,
    expiresAt: expiresDays ? new Date(Date.now() + expiresDays * 86400000) : null
  });
  res.status(201).json({ success: true, message: '邀请码创建成功', data });
});

// 停用（软删除：active=false，不删记录）
exports.remove = asyncHandler(async (req, res) => {
  await inviteService.deactivate(req.params.id);
  res.json({ success: true, message: '邀请码已停用' });
});
