const path = require('path');
const fs = require('fs');
const { validatePath } = require('../utils/security');
const { MedicalReport } = require('../models');
const accessService = require('../services/accessService');
const HttpError = require('../utils/httpError');

// 允许的文件类型目录
const ALLOWED_TYPES = ['reports', 'ocr'];

/**
 * GET /api/files/:type/:filename
 * 认证后提供上传文件访问（替代公开的 express.static 访问）。
 * 权限模型（Final Finding 2）：
 * - reports：报告是成员数据，按成员 view 权限放行（无可见性 404 / 无权限 403）；
 *   按 filePath 反查报告，查不到报告（孤儿文件）按 404 处理
 * - ocr：OCR 中间产物，无成员归属模型，保持仅认证即可访问
 */
exports.get = async (req, res, next) => {
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

    // 报告分支：反查报告并校验成员 view 权限
    // （reportService 落库的 filePath 形如 uploads/reports/<filename>）
    if (type === 'reports') {
      const report = await MedicalReport.findOne({
        where: { filePath: `uploads/reports/${filename}` },
        attributes: ['id', 'memberId']
      });
      if (!report) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        });
      }
      await accessService.assertAccess(req.user.id, report.memberId, 'view');
    }

    // 构建并验证文件路径（防路径穿越）
    // 路径锚定在 server 根目录（与拆分前 routes/ 版本解析出的绝对路径一致）
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
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
    // 权限/可见性错误交给统一 errorHandler（404/403 语义保留）
    if (error instanceof HttpError) return next(error);
    res.status(500).json({
      success: false,
      message: '获取文件失败'
    });
  }
};
