const Sequelize = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');
const inviteService = require('../services/inviteService');
const { FamilyMember, UserMemberLink } = require('../models');

exports.register = asyncHandler(async (req, res) => {
  const { status, body } = await authService.register(req.body);
  res.status(status).json(body);
});

exports.login = asyncHandler(async (req, res) => {
  const { status, body } = await authService.login(req.body);
  res.status(status).json(body);
});

exports.verify = asyncHandler(async (req, res) => {
  const { status, body } = await authService.verify(req.headers.authorization);
  res.status(status).json(body);
});

exports.initStatus = asyncHandler(async (req, res) => {
  const { status, body } = await authService.initStatus();
  res.status(status).json(body);
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { status, body } = await authService.changePassword(req.user.id, req.body);
  res.status(status).json(body);
});

exports.previewInvite = asyncHandler(async (req, res) => {
  const invite = await inviteService.validateInvite(req.body.inviteCode);
  if (invite.memberId) {
    const member = await FamilyMember.findByPk(invite.memberId, { attributes: ['id', 'name', 'gender', 'birthday'] });
    return res.json({ success: true, data: { boundMember: member } });
  }
  // 通用码:返回可认领成员(无 self link)
  const claimedMemberIds = (await UserMemberLink.findAll({ where: { role: 'self' }, attributes: ['memberId'] }))
    .map((l) => l.memberId);
  const claimable = await FamilyMember.findAll({
    where: claimedMemberIds.length ? { id: { [Sequelize.Op.notIn]: claimedMemberIds } } : {},
    attributes: ['id', 'name', 'gender', 'birthday'],
    order: [['createdAt', 'DESC']]
  });
  res.json({ success: true, data: { claimableMembers: claimable } });
});
