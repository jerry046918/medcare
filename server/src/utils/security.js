/**
 * 安全工具模块
 * 提供输入验证、消毒、文件验证等安全相关功能
 */

const path = require('path');
const fs = require('fs').promises;
const { fileMagicNumbers, allowedOCREngines } = require('../config');

/**
 * HTML 实体编码映射表
 */
const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * 对字符串进行 HTML 转义，防止 XSS 攻击
 * @param {string} str - 要转义的字符串
 * @returns {string} - 转义后的字符串
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str.replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
}

/**
 * 递归转义对象中的所有字符串值
 * @param {any} obj - 要处理的对象
 * @param {Set} visited - 已访问的对象（防止循环引用）
 * @returns {any} - 处理后的对象
 */
function sanitizeObject(obj, visited = new Set()) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 防止循环引用
  if (typeof obj === 'object' && visited.has(obj)) {
    return obj;
  }

  if (typeof obj === 'string') {
    return escapeHtml(obj);
  }

  if (Array.isArray(obj)) {
    visited.add(obj);
    return obj.map(item => sanitizeObject(item, visited));
  }

  if (typeof obj === 'object') {
    visited.add(obj);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value, visited);
    }
    return result;
  }

  return obj;
}

/**
 * 清理用户输入字符串（移除危险字符）
 * @param {string} str - 要清理的字符串
 * @param {object} options - 选项
 * @param {boolean} options.stripTags - 是否移除 HTML 标签
 * @param {number} options.maxLength - 最大长度
 * @returns {string} - 清理后的字符串
 */
function sanitizeInput(str, options = {}) {
  if (typeof str !== 'string') {
    return str;
  }

  const { stripTags = true, maxLength = 10000 } = options;

  let result = str;

  // 移除 null 字节
  result = result.replace(/\0/g, '');

  // 移除 HTML 标签（如果要求）
  if (stripTags) {
    result = result.replace(/<[^>]*>/g, '');
  }

  // 限制长度
  if (result.length > maxLength) {
    result = result.substring(0, maxLength);
  }

  return result.trim();
}

/**
 * 验证并规范化文件路径，防止路径遍历攻击
 * @param {string} filePath - 要验证的文件路径
 * @param {string} baseDir - 基础目录
 * @returns {string|null} - 规范化后的安全路径，如果不安全则返回 null
 */
function validatePath(filePath, baseDir) {
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }

  // 移除危险的路径字符
  const sanitized = filePath.replace(/\.\./g, '').replace(/[\x00-\x1f]/g, '');

  // 解析绝对路径
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, sanitized);

  // 确保解析后的路径在基础目录内
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    console.warn(`[Security] 路径遍历攻击尝试: ${filePath}`);
    return null;
  }

  return resolvedPath;
}

/**
 * 验证文件魔数（确保文件类型真实）
 * @param {Buffer} buffer - 文件缓冲区
 * @param {string} expectedMimeType - 预期的 MIME 类型
 * @returns {Promise<boolean>} - 是否匹配
 */
async function validateFileMagicNumber(buffer, expectedMimeType) {
  const magicNumbers = fileMagicNumbers[expectedMimeType];
  if (!magicNumbers) {
    // 如果没有定义魔数，跳过验证
    return true;
  }

  for (const magic of magicNumbers) {
    let matches = true;
    for (let i = 0; i < magic.length; i++) {
      if (buffer[i] !== magic[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      // WebP 需要额外检查
      if (expectedMimeType === 'image/webp') {
        // RIFF....WEBP
        const webpCheck = buffer.slice(8, 12).toString('ascii') === 'WEBP';
        return webpCheck;
      }
      return true;
    }
  }

  return false;
}

/**
 * 检测文件的实际 MIME 类型（基于魔数）
 * @param {Buffer} buffer - 文件缓冲区（前12字节）
 * @returns {string|null} - 检测到的 MIME 类型
 */
function detectMimeType(buffer) {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'image/bmp';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.slice(8, 12).toString('ascii') === 'WEBP') {
      return 'image/webp';
    }
  }

  // PDF: 25 50 44 46
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  return null;
}

/**
 * 验证上传的文件
 * @param {object} file - multer 文件对象
 * @param {string[]} allowedTypes - 允许的 MIME 类型列表
 * @returns {Promise<{valid: boolean, error?: string, detectedType?: string}>}
 */
async function validateUploadedFile(file, allowedTypes) {
  if (!file) {
    return { valid: false, error: '未提供文件' };
  }

  try {
    // 读取文件开头进行魔数验证
    const buffer = Buffer.alloc(12);
    const fd = await fs.open(file.path, 'r');
    await fd.read(buffer, 0, 12, 0);
    await fd.close();

    // 检测实际的文件类型
    const detectedType = detectMimeType(buffer);

    if (!detectedType) {
      console.warn(`[Security] 无法识别文件类型: ${file.originalname}`);
      return {
        valid: false,
        error: '无法识别的文件类型'
      };
    }

    // 检查检测到的类型是否在允许列表中
    if (!allowedTypes.includes(detectedType)) {
      console.warn(`[Security] 文件类型不在允许列表中: ${detectedType}`);
      return {
        valid: false,
        error: `不支持的文件类型: ${detectedType}`
      };
    }

    // 如果 MIME 类型不匹配但文件内容有效，记录警告但仍接受
    if (file.mimetype !== detectedType) {
      console.warn(`[Security] MIME 类型不匹配: 声明=${file.mimetype}, 实际=${detectedType}, 文件=${file.originalname}`);
      // 更新 file 对象的 mimetype 为实际类型（供后续使用）
      file.detectedMimeType = detectedType;
    }

    return { valid: true, detectedType };
  } catch (error) {
    console.error('[Security] 文件验证失败:', error);
    return { valid: false, error: '文件验证失败' };
  }
}

/**
 * 验证 OCR 引擎参数
 * @param {string} engine - 引擎名称
 * @returns {boolean}
 */
function validateOCREngine(engine) {
  if (!engine || typeof engine !== 'string') {
    return false;
  }
  return allowedOCREngines.includes(engine);
}

/**
 * 验证 ID 参数（防止 SQL 注入）
 * @param {any} id - ID 值
 * @returns {number|null}
 */
function validateId(id) {
  if (id === null || id === undefined) {
    return null;
  }

  const parsed = parseInt(id, 10);

  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/**
 * 验证日期字符串
 * @param {string} dateStr - 日期字符串
 * @returns {boolean}
 */
function validateDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

module.exports = {
  escapeHtml,
  sanitizeObject,
  sanitizeInput,
  validatePath,
  validateFileMagicNumber,
  validateUploadedFile,
  detectMimeType,
  validateOCREngine,
  validateId,
  validateDate
};
