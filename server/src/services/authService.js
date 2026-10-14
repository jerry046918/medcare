const jwt = require('jsonwebtoken');
const { User, FamilyMember, UserMemberLink, sequelize } = require('../models');
const { jwt: jwtConfig } = require('../config');
const { sanitizeInput, escapeHtml, validateDate } = require('../utils/security');
const HttpError = require('../utils/httpError');
const inviteService = require('./inviteService');
const accessService = require('./accessService');

// 说明：注册主体逻辑（事务、邀请码、首账户 admin）自 Task 9 起移至 authController.register，
// 本 service 保留凭据校验/消毒（validateCredentials）、绑定本人成员（bindSelfForUser）
// 及登录/验证/改密等分支语义（仍以 { status, body } 形式给出以保留原有分支）。

// 注册凭据消毒 + 校验（沿用旧 register 的规则与文案，不合规抛 400）
function validateCredentials(body) {
  let { username, password } = body;

  // 输入消毒
  username = sanitizeInput(username, { maxLength: 50 });
  password = sanitizeInput(password, { maxLength: 100, stripTags: false });

  // 验证输入
  if (!username || !password) {
    throw new HttpError(400, '用户名和密码不能为空');
  }

  // 用户名格式验证
  const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
  if (!usernameRegex.test(username)) {
    throw new HttpError(400, '用户名只能包含字母、数字、下划线和中文');
  }

  if (username.length < 2 || username.length > 50) {
    throw new HttpError(400, '用户名长度需要在2-50个字符之间');
  }

  if (password.length < 6) {
    throw new HttpError(400, '密码长度至少为6位');
  }

  if (password.length > 100) {
    throw new HttpError(400, '密码长度不能超过100位');
  }

  return { username, password };
}

// 为账户绑定本人成员（注册时与 POST /api/members/bind-self 复用）。
// mode=create：按 memberData 新建本人成员；mode=claim：认领既有成员。
// 已有 self link → 400；认领不存在成员 → 404；认领已被绑定成员 → 409；
// 专属邀请码与认领成员不匹配 → 400。需在调用方事务内执行（transaction 透传）。
async function bindSelfForUser(userId, { mode = 'create', memberData = {}, claimMemberId = null, inviteCode = null, transaction } = {}) {
  memberData = memberData || {}; // 调用方可能显式传 null

  // 已有 self 则拒绝
  const existing = await UserMemberLink.findOne({ where: { userId, role: 'self' }, transaction });
  if (existing) throw new HttpError(400, '该账户已绑定本人信息');

  let memberId;
  if (mode === 'claim') {
    if (!claimMemberId) throw new HttpError(400, '缺少要认领的成员ID');
    const member = await FamilyMember.findByPk(claimMemberId, { transaction });
    if (!member) throw new HttpError(404, '要认领的成员不存在');
    // 专属码与认领成员不匹配(400)先于已被绑定(409)判定——错误码优先级以规格测试为准
    if (inviteCode) {
      const invite = await inviteService.validateInvite(inviteCode);
      if (invite.memberId && invite.memberId !== claimMemberId) {
        throw new HttpError(400, '该邀请码只能绑定指定成员');
      }
    }
    const claimed = await UserMemberLink.findOne({ where: { memberId: claimMemberId, role: 'self' }, transaction });
    if (claimed) throw new HttpError(409, '该成员已被其他账户绑定');
    memberId = claimMemberId;
  } else {
    const { name, gender, birthday } = memberData;
    const cleanName = escapeHtml(sanitizeInput(name, { maxLength: 50 }));
    if (!cleanName || !['男', '女', '其他'].includes(gender)) {
      throw new HttpError(400, '本人姓名和性别为必填字段');
    }
    if (birthday && !validateDate(birthday)) throw new HttpError(400, '无效的生日日期');
    // relationship 为旧 schema 必填列（v2 迁移不改约束），本人成员固定写 '本人'
    const member = await FamilyMember.create(
      { name: cleanName, gender, birthday: birthday || null, relationship: '本人' }, { transaction });
    memberId = member.id;
  }

  await UserMemberLink.create(
    { userId, memberId, role: 'self', relationship: '本人' }, { transaction });
  return memberId;
}

// 用户登录
async function login(body) {
  try {
    let { username, password } = body;

    // 输入消毒
    username = sanitizeInput(username, { maxLength: 50 });
    password = sanitizeInput(password, { maxLength: 100, stripTags: false });

    // 验证输入
    if (!username || !password) {
      return { status: 400, body: { success: false, message: '用户名和密码不能为空' } };
    }

    // 查找用户
    const user = await User.findOne({ where: { username } });
    if (!user) {
      // 使用通用错误消息防止用户名枚举
      return { status: 401, body: { success: false, message: '用户名或密码错误' } };
    }

    // 验证密码
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return { status: 401, body: { success: false, message: '用户名或密码错误' } };
    }

    // 生成JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    const selfMember = await accessService.getSelfMember(user.id);

    return {
      status: 200,
      body: {
        success: true,
        message: '登录成功',
        data: {
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role
          },
          selfMember,
          token
        }
      }
    };
  } catch (error) {
    console.error('登录失败:', error);
    const message = process.env.NODE_ENV === 'production'
      ? '登录失败，请稍后重试'
      : `登录失败: ${error.message}`;
    return { status: 500, body: { success: false, message } };
  }
}

// 当前登录用户信息 + 本人成员
async function me(userId) {
  try {
    const user = await User.findByPk(userId, { attributes: ['id', 'username', 'displayName', 'role'] });
    if (!user) {
      return { status: 401, body: { success: false, message: '用户不存在' } };
    }
    const selfMember = await accessService.getSelfMember(userId);
    return {
      status: 200,
      body: {
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role
          },
          selfMember
        }
      }
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    const message = process.env.NODE_ENV === 'production'
      ? '获取用户信息失败，请稍后重试'
      : `获取用户信息失败: ${error.message}`;
    return { status: 500, body: { success: false, message } };
  }
}

// 验证token
async function verify(authHeader) {
  try {
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return { status: 401, body: { success: false, message: '未提供认证token' } };
    }

    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return { status: 401, body: { success: false, message: '用户不存在' } };
    }

    return {
      status: 200,
      body: {
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            createdAt: user.createdAt
          }
        }
      }
    };
  } catch (error) {
    return { status: 401, body: { success: false, message: 'Token无效或已过期' } };
  }
}

// 检查系统初始化状态
async function initStatus() {
  try {
    const userCount = await User.count();
    return {
      status: 200,
      body: {
        success: true,
        data: {
          isInitialized: userCount > 0,
          needsSetup: userCount === 0
        }
      }
    };
  } catch (error) {
    console.error('检查初始化状态失败:', error);
    return { status: 500, body: { success: false, message: '检查初始化状态失败' } };
  }
}

// 修改密码
async function changePassword(userId, body) {
  try {
    const { currentPassword, newPassword } = body;

    // 验证输入
    if (!currentPassword || !newPassword) {
      return { status: 400, body: { success: false, message: '当前密码和新密码不能为空' } };
    }

    if (newPassword.length < 6) {
      return { status: 400, body: { success: false, message: '新密码长度至少为6位' } };
    }

    if (newPassword.length > 100) {
      return { status: 400, body: { success: false, message: '新密码长度不能超过100位' } };
    }

    // 获取用户
    const user = await User.findByPk(userId);
    if (!user) {
      return { status: 404, body: { success: false, message: '用户不存在' } };
    }

    // 验证当前密码
    const isValid = await user.validatePassword(currentPassword);
    if (!isValid) {
      return { status: 401, body: { success: false, message: '当前密码不正确' } };
    }

    // 更新密码（beforeUpdate hook 会自动加密）
    await user.update({ password: newPassword });

    return { status: 200, body: { success: true, message: '密码修改成功' } };
  } catch (error) {
    console.error('修改密码失败:', error);
    return {
      status: 500,
      body: {
        success: false,
        message: process.env.NODE_ENV === 'production'
          ? '修改密码失败，请稍后重试'
          : `修改密码失败: ${error.message}`
      }
    };
  }
}

module.exports = { validateCredentials, bindSelfForUser, login, me, verify, initStatus, changePassword };
