/**
 * 系统配置 API 路由
 * 管理系统设置，包括 OCR 配置等
 */

const express = require('express');
const { SystemConfig } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * 脱敏处理：隐藏敏感密钥，只显示最后4位
 */
function maskSecret(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

/**
 * 对 OCR 配置中的敏感字段进行脱敏
 */
function maskOcrSecrets(config) {
  const masked = { ...config };
  // OpenAI
  if (masked.openai_vision?.apiKey) {
    masked.openai_vision = { ...masked.openai_vision, apiKey: maskSecret(masked.openai_vision.apiKey) };
  }
  return masked;
}

/**
 * GET /api/config
 * 获取所有公开配置
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const configs = await SystemConfig.findAll({
      where: { isPublic: true },
      order: [['category', 'ASC'], ['configKey', 'ASC']]
    });

    // 按分类组织
    const groupedConfigs = {};
    for (const config of configs) {
      if (!groupedConfigs[config.category]) {
        groupedConfigs[config.category] = [];
      }
      groupedConfigs[config.category].push({
        key: config.configKey,
        value: config.configValue,
        type: config.configType,
        description: config.description
      });
    }

    res.json({
      success: true,
      data: groupedConfigs
    });

  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败',
      error: error.message
    });
  }
});

/**
 * GET /api/config/:category
 * 获取指定分类的配置
 */
router.get('/:category', authenticateToken, async (req, res) => {
  try {
    const { category } = req.params;

    const whereClause = { category };

    const configs = await SystemConfig.findAll({
      where: whereClause,
      order: [['configKey', 'ASC']]
    });

    const result = {};
    for (const config of configs) {
      let value = config.configValue;
      
      // 根据类型转换值
      if (config.configType === 'json') {
        try {
          value = JSON.parse(config.configValue);
        } catch (e) {
          // 保持原值
        }
      } else if (config.configType === 'number') {
        value = parseFloat(config.configValue);
      } else if (config.configType === 'boolean') {
        value = config.configValue === 'true';
      }

      result[config.configKey] = {
        value,
        type: config.configType,
        description: config.description
      };
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败',
      error: error.message
    });
  }
});

/**
 * PUT /api/config/:key
 * 更新指定配置项
 */
router.put('/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, type } = req.body;

    const config = await SystemConfig.findOne({
      where: { configKey: key }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: '配置项不存在'
      });
    }

    // 转换值
    let configValue = value;
    let configType = type || config.configType;

    if (typeof value === 'object') {
      configValue = JSON.stringify(value);
      configType = 'json';
    } else if (typeof value === 'boolean') {
      configValue = value.toString();
      configType = 'boolean';
    } else if (typeof value === 'number') {
      configValue = value.toString();
      configType = 'number';
    }

    await config.update({
      configValue,
      configType
    });

    res.json({
      success: true,
      message: '配置更新成功',
      data: {
        key: config.configKey,
        value: config.configValue,
        type: config.configType
      }
    });

  } catch (error) {
    console.error('更新配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新配置失败',
      error: error.message
    });
  }
});

/**
 * POST /api/config
 * 创建新配置项
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { key, value, type, category, description, isPublic } = req.body;

    if (!key || !category) {
      return res.status(400).json({
        success: false,
        message: '配置键名和分类为必填项'
      });
    }

    // 检查是否已存在
    const existing = await SystemConfig.findOne({
      where: { configKey: key }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '配置键名已存在'
      });
    }

    // 转换值
    let configValue = value;
    let configType = type || 'string';

    if (typeof value === 'object') {
      configValue = JSON.stringify(value);
      configType = 'json';
    } else if (typeof value === 'boolean') {
      configValue = value.toString();
      configType = 'boolean';
    } else if (typeof value === 'number') {
      configValue = value.toString();
      configType = 'number';
    }

    const config = await SystemConfig.create({
      configKey: key,
      configValue,
      configType,
      category,
      description: description || null,
      isPublic: isPublic !== false
    });

    res.status(201).json({
      success: true,
      message: '配置创建成功',
      data: config
    });

  } catch (error) {
    console.error('创建配置失败:', error);
    res.status(500).json({
      success: false,
      message: '创建配置失败',
      error: error.message
    });
  }
});

/**
 * DELETE /api/config/:key
 * 删除配置项
 */
router.delete('/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;

    const config = await SystemConfig.findOne({
      where: { configKey: key }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: '配置项不存在'
      });
    }

    await config.destroy();

    res.json({
      success: true,
      message: '配置删除成功'
    });

  } catch (error) {
    console.error('删除配置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除配置失败',
      error: error.message
    });
  }
});

/**
 * POST /api/config/ocr/batch
 * 批量设置 OCR 配置
 */
router.post('/ocr/batch', authenticateToken, async (req, res) => {
  try {
    const { defaultEngine, paddleocr, openai_vision } = req.body;

    const configs = [];

    // 默认引擎
    if (defaultEngine) {
      configs.push({
        configKey: 'ocr_default_engine',
        configValue: defaultEngine,
        configType: 'string',
        category: 'ocr',
        description: '默认 OCR 引擎',
        isPublic: true
      });
    }

    // PaddleOCR 配置
    if (paddleocr) {
      configs.push({
        configKey: 'ocr_paddleocr',
        configValue: JSON.stringify(paddleocr),
        configType: 'json',
        category: 'ocr',
        description: 'PaddleOCR 配置',
        isPublic: false
      });
    }

    // OpenAI Vision 配置
    if (openai_vision) {
      // 脱敏处理 API Key（不返回完整 key）
      const safeConfig = { ...openai_vision };
      if (safeConfig.apiKey) {
        safeConfig.hasApiKey = true;
        // 不保存到公开配置
      }
      
      configs.push({
        configKey: 'ocr_openai_vision',
        configValue: JSON.stringify(safeConfig),
        configType: 'json',
        category: 'ocr',
        description: 'OpenAI Vision 配置',
        isPublic: false
      });
    }

    // 批量更新或创建
    for (const configData of configs) {
      await SystemConfig.upsert(configData);
    }

    res.json({
      success: true,
      message: 'OCR 配置保存成功'
    });

  } catch (error) {
    console.error('保存 OCR 配置失败:', error);
    res.status(500).json({
      success: false,
      message: '保存 OCR 配置失败',
      error: error.message
    });
  }
});

/**
 * GET /api/config/ocr/full
 * 获取完整的 OCR 配置（包括敏感信息，用于设置页面）
 */
router.get('/ocr/full', authenticateToken, async (req, res) => {
  try {
    const configs = await SystemConfig.findAll({
      where: { category: 'ocr' },
      order: [['configKey', 'ASC']]
    });

    const result = {
      defaultEngine: 'paddleocr',
      paddleocr: { enabled: true, pythonPath: 'python' },
      openai_vision: { enabled: false, apiKey: '', baseURL: '', model: '' }
    };

    for (const config of configs) {
      if (config.configKey === 'ocr_default_engine') {
        result.defaultEngine = config.configValue;
      } else if (config.configKey.startsWith('ocr_')) {
        const key = config.configKey.replace('ocr_', '');
        try {
          result[key] = typeof config.configValue === 'string' 
            ? JSON.parse(config.configValue) 
            : config.configValue;
        } catch (e) {
          result[key] = config.configValue;
        }
      }
    }

    res.json({
      success: true,
      data: maskOcrSecrets(result)
    });

  } catch (error) {
    console.error('获取 OCR 配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取 OCR 配置失败',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

module.exports = router;
