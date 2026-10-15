const { SystemConfig } = require('../models');
const HttpError = require('../utils/httpError');

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
 * 递归脱敏任意结构中的 apiKey 字段（Final Finding 3）。
 * getByCategory 的 json 值是任意对象，统一按字段名脱敏，避免逐 key 维护白名单；
 * 非字符串 apiKey 一律置为 '****'。
 */
function maskApiKeyDeep(value) {
  if (Array.isArray(value)) return value.map(maskApiKeyDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'apiKey') {
        out[k] = typeof v === 'string' && v ? maskSecret(v) : '****';
      } else {
        out[k] = maskApiKeyDeep(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * GET /api/config
 * 获取所有公开配置
 */
async function getPublicConfigs() {
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

    return groupedConfigs;
  } catch (error) {
    console.error('获取配置失败:', error);
    throw new HttpError(500, '获取配置失败', error.message);
  }
}

/**
 * GET /api/config/:category
 * 获取指定分类的配置。
 * 非管理员调用者（Final Finding 3）：apiKey 一律脱敏（复用 getOcrFull 的 maskSecret），
 * 管理员返回原始值。
 */
async function getByCategory(category, role) {
  try {
    const whereClause = { category };

    const configs = await SystemConfig.findAll({
      where: whereClause,
      order: [['configKey', 'ASC']]
    });

    const isAdmin = role === 'admin';
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
        value: isAdmin ? value : maskApiKeyDeep(value),
        type: config.configType,
        description: config.description
      };
    }

    return result;
  } catch (error) {
    console.error('获取配置失败:', error);
    throw new HttpError(500, '获取配置失败', error.message);
  }
}

/**
 * PUT /api/config/:key
 * 更新指定配置项
 */
async function updateByKey(key, body) {
  try {
    const { value, type } = body;

    const config = await SystemConfig.findOne({
      where: { configKey: key }
    });

    if (!config) {
      throw new HttpError(404, '配置项不存在');
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

    return {
      key: config.configKey,
      value: config.configValue,
      type: config.configType
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('更新配置失败:', error);
    throw new HttpError(500, '更新配置失败', error.message);
  }
}

/**
 * POST /api/config
 * 创建新配置项
 */
async function create(body) {
  try {
    const { key, value, type, category, description, isPublic } = body;

    if (!key || !category) {
      throw new HttpError(400, '配置键名和分类为必填项');
    }

    // 检查是否已存在
    const existing = await SystemConfig.findOne({
      where: { configKey: key }
    });

    if (existing) {
      throw new HttpError(400, '配置键名已存在');
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

    return config;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('创建配置失败:', error);
    throw new HttpError(500, '创建配置失败', error.message);
  }
}

/**
 * DELETE /api/config/:key
 * 删除配置项
 */
async function remove(key) {
  try {
    const config = await SystemConfig.findOne({
      where: { configKey: key }
    });

    if (!config) {
      throw new HttpError(404, '配置项不存在');
    }

    await config.destroy();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('删除配置失败:', error);
    throw new HttpError(500, '删除配置失败', error.message);
  }
}

/**
 * POST /api/config/ocr/batch
 * 批量设置 OCR 配置
 */
async function saveOcrBatch(body) {
  try {
    const { defaultEngine, paddleocr, openai_vision } = body;

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
  } catch (error) {
    console.error('保存 OCR 配置失败:', error);
    throw new HttpError(500, '保存 OCR 配置失败', error.message);
  }
}

/**
 * GET /api/config/ocr/full
 * 获取完整的 OCR 配置（包括敏感信息，用于设置页面）
 */
async function getOcrFull() {
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

    return maskOcrSecrets(result);
  } catch (error) {
    console.error('获取 OCR 配置失败:', error);
    throw new HttpError(500, '获取 OCR 配置失败',
      process.env.NODE_ENV === 'production' ? undefined : error.message);
  }
}

module.exports = { getPublicConfigs, getByCategory, updateByKey, create, remove, saveOcrBatch, getOcrFull };
