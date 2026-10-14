const asyncHandler = require('../utils/asyncHandler');
const memberService = require('../services/memberService');
const authService = require('../services/authService');
const { sequelize } = require('../models');

// 登录态补绑本人成员（老账户用，无邀请码分支）；bindSelfForUser 复用注册逻辑
exports.bindSelf = asyncHandler(async (req, res) => {
  const { mode, memberData, claimMemberId } = req.body;
  const memberId = await sequelize.transaction(async (t) =>
    authService.bindSelfForUser(req.user.id, {
      mode, memberData, claimMemberId, inviteCode: null, transaction: t
    })
  );
  res.json({ success: true, message: '绑定本人信息成功', data: { memberId } });
});

exports.list = asyncHandler(async (req, res) => {
  const data = await memberService.listByUser(req.user.id);
  res.json({ success: true, data });
});
exports.getDetail = asyncHandler(async (req, res) => {
  const data = await memberService.getById(req.user.id, req.params.id);
  res.json({ success: true, data });
});
exports.create = asyncHandler(async (req, res) => {
  const data = await memberService.create(req.user.id, req.body);
  res.status(201).json({ success: true, message: '家庭成员创建成功', data });
});
exports.update = asyncHandler(async (req, res) => {
  const data = await memberService.update(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: '家庭成员更新成功', data });
});
exports.remove = asyncHandler(async (req, res) => {
  await memberService.remove(req.user.id, req.params.id);
  res.json({ success: true, message: '家庭成员删除成功' });
});
