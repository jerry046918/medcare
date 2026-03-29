const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { validatePath } = require('../utils/security');

const router = express.Router();

// 允许的文件类型目录
const ALLOWED_TYPES = ['reports', 'ocr'];

/**
 * GET /api/files/:type/:filename
 * 认证后提供上传文件访问（替代公开的 express.static 访问）
 */
router.get('/:type/:filename', authenticateToken, (req, res) => {
  try {
    const { type, filename } = req.params;

    // 验证文件类型目录
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: '无效的文件类型'
      });
    }

    // 验证文件名不含路径穿越字符
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: '无效的文件名'
      });
    }

    // 构建并验证文件路径（防路径穿越）
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const relativePath = path.join(type, filename);
    const filePath = validatePath(relativePath, uploadsDir);

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '无效的文件路径'
      });
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取文件失败'
    });
  }
});

module.exports = router;
