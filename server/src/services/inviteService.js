const crypto = require('crypto');
const { InviteCode, FamilyMember, UserMemberLink, sequelize } = require('../models');
const HttpError = require('../utils/httpError');

// 无易混淆字符(去 0O1IL)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function createInvite({ createdById, memberId = null, maxUses = 1, expiresAt = null }) {
  if (memberId) {
    const member = await FamilyMember.findByPk(memberId);
    if (!member) throw new HttpError(400, '指定成员不存在');
    const claimed = await UserMemberLink.findOne({ where: { memberId, role: 'self' } });
    if (claimed) throw new HttpError(400, '该成员已被本人账户绑定,不能生成专属邀请码');
  }
  for (let i = 0; i < 5; i++) {
    try {
      return await InviteCode.create({ code: generateCode(), createdById, memberId, maxUses, expiresAt, active: true });
    } catch (e) {
      if (e.name !== 'SequelizeUniqueConstraintError') throw e;
    }
  }
  throw new HttpError(500, '生成邀请码失败，请重试');
}

async function validateInvite(code) {
  if (!code || typeof code !== 'string') throw new HttpError(400, '邀请码不能为空');
  const invite = await InviteCode.findOne({ where: { code: code.trim().toUpperCase() } });
  if (!invite) throw new HttpError(400, '邀请码无效');
  if (!invite.active) throw new HttpError(400, '邀请码已停用');
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) throw new HttpError(400, '邀请码已过期');
  if (invite.usedCount >= invite.maxUses) throw new HttpError(400, '邀请码使用次数已用完');
  return invite;
}

// 原子消费:条件更新防并发超发
async function consumeInvite(code, transaction) {
  const invite = await validateInvite(code);
  const [affected] = await InviteCode.update(
    { usedCount: invite.usedCount + 1 },
    {
      where: { id: invite.id, usedCount: invite.usedCount, active: true },
      transaction
    }
  );
  if (affected === 0) throw new HttpError(400, '邀请码使用次数已用完');
  return invite;
}

async function listInvites() {
  return InviteCode.findAll({
    include: [
      { association: 'createdBy', attributes: ['id', 'username'] },
      { association: 'member', attributes: ['id', 'name'] }
    ],
    order: [['createdAt', 'DESC']]
  });
}

async function deactivate(id) {
  const invite = await InviteCode.findByPk(id);
  if (!invite) throw new HttpError(404, '邀请码不存在');
  invite.active = false;
  await invite.save();
  return invite;
}

module.exports = { createInvite, validateInvite, consumeInvite, listInvites, deactivate };
