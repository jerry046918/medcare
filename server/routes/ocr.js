/**
 * OCR API 路由
 * 提供图片上传、OCR 识别、指标解析等功能
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const { ocrLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { ocrService, OCR_ENGINE, processPDF } = require('../services/ocrService');
const { processOCRResult, createIndicatorFromExtracted } = require('../services/indicatorParserService');
const { SystemConfig, MedicalIndicator } = require('../models');
const {
  sanitizeInput,
  validatePath,
  validateUploadedFile,
  validateOCREngine
} = require('../utils/security');
const { upload: uploadConfig, allowedOCREngines } = require('../config');

const router = express.Router();

// 安全的文件名生成函数
function generateSafeFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  // 只允许安全的扩展名
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf'];
  if (!allowedExtensions.includes(ext)) {
    return null;
  }
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
  return `ocr-${uniqueSuffix}${ext}`;
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/ocr');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = generateSafeFilename(file.originalname);
    if (!safeName) {
      return cb(new Error('不支持的文件扩展名'));
    }
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: uploadConfig.maxFileSize // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [...uploadConfig.allowedImageTypes, ...uploadConfig.allowedDocTypes];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，仅支持 JPG、PNG、GIF、BMP、WebP 和 PDF 格式'));
    }
  }
});

/**
 * 获取 OCR 配置
 */
async function getOCRConfig() {
  try {
    const configs = await SystemConfig.findAll({
      where: { category: 'ocr' }
    });

    const config = {
      defaultEngine: OCR_ENGINE.PADDLEOCR,
      paddleocr: { enabled: true },
      openai_vision: { enabled: false },
      baidu_ocr: { enabled: false },
      tencent_ocr: { enabled: false }
    };

    for (const item of configs) {
      if (item.configKey === 'ocr_default_engine') {
        config.defaultEngine = item.configValue;
      } else if (item.configKey.startsWith('ocr_')) {
        const engineKey = item.configKey.replace('ocr_', '');
        try {
          config[engineKey] = typeof item.configValue === 'string'
            ? JSON.parse(item.configValue)
            : item.configValue;
        } catch (e) {
          config[engineKey] = item.configValue;
        }
      }
    }

    return config;
  } catch (error) {
    console.error('获取 OCR 配置失败:', error);
    return {
      defaultEngine: OCR_ENGINE.PADDLEOCR,
      paddleocr: { enabled: true }
    };
  }
}

/**
 * 初始化 OCR 服务
 */
let ocrInitialized = false;

async function ensureOCRInitialized() {
  if (!ocrInitialized) {
    const config = await getOCRConfig();
    await ocrService.initializeEngines(config);
    ocrInitialized = true;
  }
  return ocrService;
}

/**
 * POST /api/ocr/upload
 * 上传图片并进行 OCR 识别
 */
router.post('/upload', authenticateToken, ocrLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传图片文件'
      });
    }

    // 验证上传的文件
    const allowedTypes = [...uploadConfig.allowedImageTypes, ...uploadConfig.allowedDocTypes];
    const validation = await validateUploadedFile(req.file, allowedTypes);
    if (!validation.valid) {
      // 删除不合法的文件
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        // 忽略删除错误
      }
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    const { engine } = req.body;

    // 验证 OCR 引擎参数
    let useEngine = engine;
    if (engine && !validateOCREngine(engine)) {
      console.warn(`[OCR] 无效的引擎参数: ${engine}`);
      useEngine = null; // 使用默认引擎
    }

    // 安全地读取文件
    const baseDir = path.join(__dirname, '../uploads/ocr');
    const safePath = validatePath(req.file.path, baseDir);
    if (!safePath) {
      return res.status(400).json({
        success: false,
        message: '无效的文件路径'
      });
    }

    const imageBuffer = await fs.readFile(safePath);

    // 初始化 OCR 服务
    const service = await ensureOCRInitialized();

    // 获取配置以确定使用的引擎
    const config = await getOCRConfig();
    if (!useEngine) {
      useEngine = config.defaultEngine;
    }

    // 再次验证最终使用的引擎
    if (!allowedOCREngines.includes(useEngine)) {
      useEngine = OCR_ENGINE.PADDLEOCR;
    }

    // 执行 OCR 识别
    const ocrResult = await service.recognize(imageBuffer, {
      engine: useEngine,
      mimeType: req.file.mimetype
    });

    // 清理临时文件
    try {
      await fs.unlink(safePath);
    } catch (e) {
      console.warn('清理临时文件失败:', e.message);
    }

    res.json({
      success: true,
      data: {
        ocrResult,
        engine: useEngine
      }
    });

  } catch (error) {
    console.error('OCR 识别失败:', error);
    // 清理临时文件
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        // 忽略
      }
    }
    res.status(500).json({
      success: false,
      message: 'OCR 识别失败',
      error: process.env.NODE_ENV === 'production' ? '服务器错误' : error.message
    });
  }
});

/**
 * POST /api/ocr/parse
 * 解析 OCR 识别结果，提取指标并匹配
 */
router.post('/parse', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: '请提供 OCR 识别的文本内容'
      });
    }

    // 限制文本长度
    const sanitizedText = sanitizeInput(text, { maxLength: 50000, stripTags: false });

    // 处理 OCR 结果，提取和匹配指标
    const result = await processOCRResult({ text: sanitizedText });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('指标解析失败:', error);
    res.status(500).json({
      success: false,
      message: '指标解析失败'
    });
  }
});

/**
 * POST /api/ocr/recognize-and-parse
 * 上传图片，识别并解析（一站式接口）
 */
router.post('/recognize-and-parse', authenticateToken, ocrLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传图片文件'
      });
    }

    // 验证上传的文件
    const allowedTypes = [...uploadConfig.allowedImageTypes, ...uploadConfig.allowedDocTypes];
    const validation = await validateUploadedFile(req.file, allowedTypes);
    if (!validation.valid) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {}
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    const { engine } = req.body;

    // 验证 OCR 引擎参数
    let useEngine = engine;
    if (engine && !validateOCREngine(engine)) {
      useEngine = null;
    }

    // 安全地读取文件
    const baseDir = path.join(__dirname, '../uploads/ocr');
    const safePath = validatePath(req.file.path, baseDir);
    if (!safePath) {
      return res.status(400).json({
        success: false,
        message: '无效的文件路径'
      });
    }

    const imageBuffer = await fs.readFile(safePath);

    // 初始化 OCR 服务
    const service = await ensureOCRInitialized();

    // 获取配置以确定使用的引擎
    const config = await getOCRConfig();
    if (!useEngine) {
      useEngine = config.defaultEngine;
    }

    // 再次验证最终使用的引擎
    if (!allowedOCREngines.includes(useEngine)) {
      useEngine = OCR_ENGINE.PADDLEOCR;
    }

    const isPDF = req.file.mimetype === 'application/pdf' ||
                  req.file.originalname?.toLowerCase().endsWith('.pdf');

    let ocrResult;
    let parseResult;

    if (isPDF) {
      // PDF — extract text directly
      const pdfResult = await processPDF(imageBuffer);

      if (!pdfResult.success) {
        try { await fs.unlink(safePath); } catch (e) {}
        return res.json({
          success: false,
          message: pdfResult.error || 'PDF文字提取失败',
          data: { totalPages: pdfResult.totalPages }
        });
      }

      ocrResult = {
        success: true,
        text: pdfResult.text,
        engine: 'pdf-extract',
        totalPages: pdfResult.totalPages
      };
      parseResult = await processOCRResult({ text: pdfResult.text });
    } else {
      // Image — existing OCR flow
      ocrResult = await service.recognize(imageBuffer, {
        engine: useEngine,
        mimeType: req.file.mimetype
      });
      parseResult = await processOCRResult({ text: ocrResult.text });
    }

    // 清理临时文件
    try {
      await fs.unlink(safePath);
    } catch (e) {
      console.warn('清理临时文件失败:', e.message);
    }

    res.json({
      success: true,
      data: {
        ocr: ocrResult,
        indicators: parseResult,
        engine: useEngine,
        isPDF
      }
    });

  } catch (error) {
    console.error('OCR 识别和解析失败:', error);
    // 清理临时文件
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: 'OCR 识别和解析失败',
      error: process.env.NODE_ENV === 'production' ? '服务器错误' : error.message
    });
  }
});

/**
 * POST /api/ocr/create-indicator
 * 为未匹配的指标创建新指标
 */
router.post('/create-indicator', authenticateToken, async (req, res) => {
  try {
    const { extracted, type } = req.body;

    if (!extracted || !extracted.name) {
      return res.status(400).json({
        success: false,
        message: '请提供要创建的指标信息'
      });
    }

    // 消毒输入
    const sanitizedExtracted = {
      ...extracted,
      name: sanitizeInput(extracted.name, { maxLength: 100 }),
      unit: sanitizeInput(extracted.unit, { maxLength: 20 })
    };
    const sanitizedType = sanitizeInput(type || '血液', { maxLength: 20 });

    const indicator = await createIndicatorFromExtracted(sanitizedExtracted, sanitizedType);

    res.json({
      success: true,
      message: '指标创建成功',
      data: indicator
    });

  } catch (error) {
    console.error('创建指标失败:', error);
    res.status(500).json({
      success: false,
      message: '创建指标失败'
    });
  }
});

/**
 * GET /api/ocr/engines
 * 获取可用的 OCR 引擎列表
 */
router.get('/engines', authenticateToken, async (req, res) => {
  try {
    const service = await ensureOCRInitialized();
    const engines = await service.getAvailableEngines();

    res.json({
      success: true,
      data: engines
    });

  } catch (error) {
    console.error('获取引擎列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取引擎列表失败'
    });
  }
});

/**
 * GET /api/ocr/config
 * 获取 OCR 配置（非敏感信息）
 */
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const configs = await SystemConfig.findAll({
      where: { category: 'ocr', isPublic: true },
      attributes: ['configKey', 'configValue', 'description']
    });

    res.json({
      success: true,
      data: configs
    });

  } catch (error) {
    console.error('获取 OCR 配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取 OCR 配置失败'
    });
  }
});

/**
 * POST /api/ocr/confirm-match
 * 用户确认指标匹配，自动学习别名
 *
 * 当用户手动选择一个指标来匹配 OCR 识别结果时，
 * 系统会自动将 OCR 识别的名称添加为该指标的别名
 */
router.post('/confirm-match', authenticateToken, async (req, res) => {
  try {
    const { indicatorId, extractedName, autoAddAlias = true } = req.body;

    if (!indicatorId || !extractedName) {
      return res.status(400).json({
        success: false,
        message: '请提供指标ID和识别出的名称'
      });
    }

    // 验证 ID
    const validId = parseInt(indicatorId, 10);
    if (isNaN(validId) || validId <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的指标ID'
      });
    }

    // 查找指标
    const indicator = await MedicalIndicator.findByPk(validId);
    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: '指标不存在'
      });
    }

    // 清理识别名称（消毒）
    const cleanExtractedName = sanitizeInput(extractedName.trim(), { maxLength: 100 });

    // 检查是否需要添加别名
    let aliasAdded = false;
    if (autoAddAlias) {
      // 获取现有别名
      const currentAliases = indicator.aliases || [];

      // 检查是否已经存在（精确匹配或与名称相同）
      const alreadyExists =
        indicator.name === cleanExtractedName ||
        currentAliases.includes(cleanExtractedName);

      if (!alreadyExists) {
        // 添加新别名
        const newAliases = [...currentAliases, cleanExtractedName];
        await indicator.update({ aliases: newAliases });
        aliasAdded = true;

        console.log(`[OCR] 学习新别名: 指标 "${indicator.name}" 添加别名 "${cleanExtractedName}"`);
      }
    }

    res.json({
      success: true,
      message: aliasAdded ? '匹配确认成功，已学习新别名' : '匹配确认成功',
      data: {
        indicatorId: indicator.id,
        indicatorName: indicator.name,
        extractedName: cleanExtractedName,
        aliasAdded,
        currentAliases: indicator.aliases
      }
    });

  } catch (error) {
    console.error('确认匹配失败:', error);
    res.status(500).json({
      success: false,
      message: '确认匹配失败'
    });
  }
});

module.exports = router;
