const jwt = require('jsonwebtoken');
const { User, sequelize } = require('../models');
const { jwt: jwtConfig } = require('../config');
const { sanitizeInput } = require('../utils/security');

// 说明：auth 逻辑自旧 routes/auth.js 原样迁移（register 仍仅限首账户，含事务+行锁防并发注册），
// 响应仍由 service 以 { status, body } 形式给出以保留原有分支语义；Task 9 将整体重写。

// 用户注册（仅限首次使用）— 使用事务防止并发注册竞态
async function register(body) {
  const transaction = await sequelize.transaction();
  const fail = async (status, message) => {
    await transaction.rollback();
    return { status, body: { success: false, message } };
  };
  try {
    let { username, password } = body;

    // 输入消毒
    username = sanitizeInput(username, { maxLength: 50 });
    password = sanitizeInput(password, { maxLength: 100, stripTags: false });

    // 验证输入
    if (!username || !password) {
      return await fail(400, '用户名和密码不能为空');
    }

    // 用户名格式验证
    const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
    if (!usernameRegex.test(username)) {
      return await fail(400, '用户名只能包含字母、数字、下划线和中文');
    }

    if (username.length < 2 || username.length > 50) {
      return await fail(400, '用户名长度需要在2-50个字符之间');
    }

    if (password.length < 6) {
      return await fail(400, '密码长度至少为6位');
    }

    if (password.length > 100) {
      return await fail(400, '密码长度不能超过100位');
    }

    // 使用行锁检查是否已有用户（防止并发注册竞态条件）
    const existingUsers = await User.findAll({
      attributes: ['id'],
      lock: true,
      transaction
    });

    if (existingUsers.length > 0) {
      return await fail(400, '系统已有管理员用户，无法重复注册');
    }

    // 检查用户名是否已存在
    const existingUser = await User.findOne({
      where: { username },
      transaction
    });
    if (existingUser) {
      return await fail(400, '用户名已存在');
    }

    // 创建用户
    const user = await User.create({ username, password }, { transaction });

    // 生成JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    await transaction.commit();

    return {
      status: 201,
      body: {
        success: true,
        message: '管理员账户创建成功',
        data: {
          user: {
            id: user.id,
            username: user.username,
            createdAt: user.createdAt
          },
          token
        }
      }
    };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error('注册失败:', error);
    const message = process.env.NODE_ENV === 'production'
      ? '注册失败，请稍后重试'
      : `注册失败: ${error.message}`;
    return { status: 500, body: { success: false, message } };
  }
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

    return {
      status: 200,
      body: {
        success: true,
        message: '登录成功',
        data: {
          user: {
            id: user.id,
            username: user.username,
            createdAt: user.createdAt
          },
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

module.exports = { register, login, verify, initStatus, changePassword };
