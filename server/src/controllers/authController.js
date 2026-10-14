const Sequelize = require('sequelize');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');
const inviteService = require('../services/inviteService');
const { jwt: jwtConfig } = require('../config');
const { User, sequelize, FamilyMember, UserMemberLink } = require('../models');
const HttpError = require('../utils/httpError');
const { sanitizeInput, escapeHtml } = require('../utils/security');

// 注册（v2）：首账户免邀请码直接成为 admin；后续账户必须持有效邀请码，
// 并在同一事务内绑定本人成员（mode=create 新建 / mode=claim 认领）、原子消费邀请码。
exports.register = asyncHandler(async (req, res) => {
  let { username, password, inviteCode, mode, memberData = {}, claimMemberId } = req.body;

  // 现有 username/password 消毒与校验原样沿用（格式/长度），不合规直接 400
  ({ username, password } = authService.validateCredentials(req.body));

  const { user, token, isFirst, selfMember } = await sequelize.transaction(async (t) => {
    const userCount = await User.count({ transaction: t });
    let role = 'member';
    if (userCount === 0) {
      role = 'admin'; // 首个账户免邀请码
    } else if (!inviteCode) {
      throw new HttpError(400, '需要邀请码');
    }
    if (inviteCode) await inviteService.validateInvite(inviteCode); // 先校验，消费放最后

    // 用户名唯一沿用旧实现（避免撞唯一约束落成 500）
    const existingUser = await User.findOne({ where: { username }, transaction: t });
    if (existingUser) throw new HttpError(400, '用户名已存在');

    const created = await User.create({ username, password, role }, { transaction: t });
    const memberId = await authService.bindSelfForUser(created.id, { mode, memberData, claimMemberId, inviteCode, transaction: t });
    // 响应带上本人成员（前端注册后无需再调 /auth/me 即可拿到 selfMember）
    const selfMember = await FamilyMember.findByPk(memberId, {
      attributes: ['id', 'name', 'gender', 'birthday'], transaction: t
    });
    if (inviteCode) await inviteService.consumeInvite(inviteCode, t); // 原子消费（条件更新防超发）

    const signed = jwt.sign({ id: created.id, username: created.username }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
    return { user: created, token: signed, isFirst: userCount === 0, selfMember };
  });

  res.status(201).json({
    success: true,
    message: isFirst ? '管理员账户创建成功' : '注册成功',
    data: {
      user: { id: user.id, username: user.username, displayName: user.displayName ?? null, role: user.role },
      token,
      selfMember
    }
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { status, body } = await authService.login(req.body);
  res.status(status).json(body);
});

exports.me = asyncHandler(async (req, res) => {
  const { status, body } = await authService.me(req.user.id);
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

// 更新个人资料（v2）：登录态仅允许修改自己的 displayName；
// 消毒 + 限长 50（与 User.displayName 列约束一致；转义后复核长度，避免实体展开越界落 500），
// 返回更新后的用户基础字段
exports.updateProfile = asyncHandler(async (req, res) => {
  const { displayName } = req.body;
  const clean = escapeHtml(sanitizeInput(String(displayName ?? ''), { maxLength: 50 }));
  if (!clean) throw new HttpError(400, 'displayName 不能为空');
  if (clean.length > 50) throw new HttpError(400, 'displayName 最长50个字符');
  const user = await User.findByPk(req.user.id);
  if (!user) throw new HttpError(401, '用户不存在');
  await user.update({ displayName: clean });
  res.json({
    success: true,
    message: '资料已更新',
    data: { id: user.id, username: user.username, displayName: user.displayName, role: user.role }
  });
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
