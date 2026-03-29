const express = require('express');
const jwt = require('jsonwebtoken');
const { User, sequelize } = require('../models');
const { jwt: jwtConfig } = require('../config');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, validateDate } = require('../utils/security');

const router = express.Router();

// 用户注册（仅限首次使用）— 使用事务防止并发注册竞态
router.post('/register', authLimiter, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    let { username, password } = req.body;

    // 输入消毒
    username = sanitizeInput(username, { maxLength: 50 });
    password = sanitizeInput(password, { maxLength: 100, stripTags: false });

    // 验证输入
    if (!username || !password) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 用户名格式验证
    const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
    if (!usernameRegex.test(username)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '用户名只能包含字母、数字、下划线和中文'
      });
    }

    if (username.length < 2 || username.length > 50) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '用户名长度需要在2-50个字符之间'
      });
    }

    if (password.length < 6) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '密码长度至少为6位'
      });
    }

    if (password.length > 100) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '密码长度不能超过100位'
      });
    }

    // 使用行锁检查是否已有用户（防止并发注册竞态条件）
    const existingUsers = await User.findAll({
      attributes: ['id'],
      lock: true,
      transaction
    });

    if (existingUsers.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '系统已有管理员用户，无法重复注册'
      });
    }

    // 检查用户名是否已存在
    const existingUser = await User.findOne({
      where: { username },
      transaction
    });
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
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

    res.status(201).json({
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
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error('注册失败:', error);
    const message = process.env.NODE_ENV === 'production'
      ? '注册失败，请稍后重试'
      : `注册失败: ${error.message}`;
    res.status(500).json({
      success: false,
      message
    });
  }
});

// 用户登录
router.post('/login', authLimiter, async (req, res) => {
  try {
    let { username, password } = req.body;

    // 输入消毒
    username = sanitizeInput(username, { maxLength: 50 });
    password = sanitizeInput(password, { maxLength: 100, stripTags: false });

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 查找用户
    const user = await User.findOne({ where: { username } });
    if (!user) {
      // 使用通用错误消息防止用户名枚举
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 验证密码
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    res.json({
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
    });
  } catch (error) {
    console.error('登录失败:', error);
    const message = process.env.NODE_ENV === 'production'
      ? '登录失败，请稍后重试'
      : `登录失败: ${error.message}`;
    res.status(500).json({
      success: false,
      message
    });
  }
});

// 验证token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证token'
      });
    }

    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token无效或已过期'
    });
  }
});

// 检查系统初始化状态
router.get('/init-status', async (req, res) => {
  try {
    const userCount = await User.count();
    res.json({
      success: true,
      data: {
        isInitialized: userCount > 0,
        needsSetup: userCount === 0
      }
    });
  } catch (error) {
    console.error('检查初始化状态失败:', error);
    res.status(500).json({
      success: false,
      message: '检查初始化状态失败'
    });
  }
});

// 修改密码
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 验证输入
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '当前密码和新密码不能为空'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度至少为6位'
      });
    }

    if (newPassword.length > 100) {
      return res.status(400).json({
        success: false,
        message: '新密码长度不能超过100位'
      });
    }

    // 获取用户
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const isValid = await user.validatePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: '当前密码不正确'
      });
    }

    // 更新密码（beforeUpdate hook 会自动加密）
    await user.update({ password: newPassword });

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production'
        ? '修改密码失败，请稍后重试'
        : `修改密码失败: ${error.message}`
    });
  }
});

module.exports = router;
