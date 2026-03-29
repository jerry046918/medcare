/**
 * OCR 服务模块
 * 支持多种 OCR 引擎：PaddleOCR (本地)、OpenAI Vision、百度 OCR、腾讯 OCR
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');  // 同步方法
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
// OCR 引擎类型
const OCR_ENGINE = {
  PADDLEOCR: 'paddleocr',
  OPENAI_VISION: 'openai_vision',
  BAIDU_OCR: 'baidu_ocr',
  TENCENT_OCR: 'tencent_ocr'
};

/**
 * 基础 OCR 引擎类
 */
class BaseOCREngine {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
  }

  async recognize(imageBuffer, options = {}) {
    throw new Error('子类必须实现 recognize 方法');
  }

  async isAvailable() {
    return false;
  }
}

/**
 * PaddleOCR 引擎（本地 Python）
 */
class PaddleOCREngine extends BaseOCREngine {
  constructor(config = {}) {
    super(config);
    this.name = OCR_ENGINE.PADDLEOCR;
    // 使用嵌入版 Python 3.11（避免 Python 3.13 + numpy 2.x 兼容性问题）
    const embeddedPythonPath = path.join(__dirname, '../python311/python.exe');
    this.pythonPath = config.pythonPath || (fsSync.existsSync(embeddedPythonPath) ? embeddedPythonPath : 'python');
    this.scriptPath = config.scriptPath || path.join(__dirname, 'paddle_ocr_worker.py');
  }

  async isAvailable() {
    try {
      // 检查 Python 脚本是否存在
      await fs.access(this.scriptPath);
      return true;
    } catch {
      return false;
    }
  }

  async recognize(imageBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      const tempImagePath = path.join(__dirname, `../uploads/ocr/temp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.png`);
      
      // 临时保存图片
      fs.writeFile(tempImagePath, imageBuffer)
        .then(() => {
          const args = [
            this.scriptPath,
            tempImagePath,
            '--lang', options.lang || 'ch'
          ];

          const process = spawn(this.pythonPath, args, {
            cwd: __dirname
          });

          let stdout = '';
          let stderr = '';

          process.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          process.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          process.on('close', async (code) => {
            // 清理临时文件
            try {
              await fs.unlink(tempImagePath);
            } catch (e) {
              // 忽略删除失败
            }

            if (code === 0) {
              try {
                const result = JSON.parse(stdout);
                resolve({
                  success: true,
                  engine: this.name,
                  text: result.text,
                  boxes: result.boxes || [],
                  confidence: result.confidence || 0
                });
              } catch (e) {
                reject(new Error(`解析 PaddleOCR 输出失败: ${e.message}`));
              }
            } else {
              reject(new Error(`PaddleOCR 执行失败: ${stderr}`));
            }
          });

          process.on('error', (err) => {
            reject(new Error(`启动 PaddleOCR 失败: ${err.message}`));
          });
        })
        .catch(reject);
    });
  }
}

/**
 * OpenAI Vision 引擎
 */
class OpenAIVisionEngine extends BaseOCREngine {
  constructor(config = {}) {
    super(config);
    this.name = OCR_ENGINE.OPENAI_VISION;
    this.apiKey = config.apiKey || '';
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o';
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  async recognize(imageBuffer, options = {}) {
    if (!this.apiKey) {
      throw new Error('OpenAI API Key 未配置');
    }

    const base64Image = imageBuffer.toString('base64');
    const mimeType = options.mimeType || 'image/png';

    const prompt = options.prompt || `请识别这张医疗报告图片中的所有文字内容，特别注意：
1. 患者信息（姓名、年龄、性别等）
2. 检验项目和对应的数值
3. 参考范围
4. 异常标记（如偏高、偏低）
5. 检验日期和医院信息

请以结构化的方式返回识别结果，用 JSON 格式输出。`;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 4096,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const content = response.data.choices[0].message.content;
      const result = JSON.parse(content);

      return {
        success: true,
        engine: this.name,
        text: result.text || content,
        structured: result,
        confidence: 0.95
      };
    } catch (error) {
      throw new Error(`OpenAI Vision 识别失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

/**
 * 百度 OCR 引擎
 */
class BaiduOCREngine extends BaseOCREngine {
  constructor(config = {}) {
    super(config);
    this.name = OCR_ENGINE.BAIDU_OCR;
    this.apiKey = config.apiKey || '';
    this.secretKey = config.secretKey || '';
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  async isAvailable() {
    return !!(this.apiKey && this.secretKey);
  }

  async getAccessToken() {
    // 如果 token 未过期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://aip.baidubce.com/oauth/2.0/token',
        null,
        {
          params: {
            grant_type: 'client_credentials',
            client_id: this.apiKey,
            client_secret: this.secretKey
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpireTime = Date.now() + (response.data.expires_in - 300) * 1000; // 提前5分钟过期

      return this.accessToken;
    } catch (error) {
      throw new Error(`获取百度 OCR Access Token 失败: ${error.message}`);
    }
  }

  async recognize(imageBuffer, options = {}) {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('百度 OCR API Key 未配置');
    }

    const accessToken = await this.getAccessToken();
    const base64Image = imageBuffer.toString('base64');

    try {
      // 使用通用文字识别（高精度版）
      const response = await axios.post(
        `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_general`,
        `image=${encodeURIComponent(base64Image)}`,
        {
          params: { access_token: accessToken },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30000
        }
      );

      if (response.data.error_code) {
        throw new Error(`百度 OCR 错误: ${response.data.error_msg}`);
      }

      // 提取文字
      const text = response.data.words_result
        .map(item => item.words)
        .join('\n');

      return {
        success: true,
        engine: this.name,
        text,
        wordsResult: response.data.words_result,
        confidence: response.data.words_result.reduce((sum, item) => sum * item.min_probability, 1)
      };
    } catch (error) {
      throw new Error(`百度 OCR 识别失败: ${error.message}`);
    }
  }
}

/**
 * 腾讯 OCR 引擎
 */
class TencentOCREngine extends BaseOCREngine {
  constructor(config = {}) {
    super(config);
    this.name = OCR_ENGINE.TENCENT_OCR;
    this.secretId = config.secretId || '';
    this.secretKey = config.secretKey || '';
    this.region = config.region || 'ap-beijing';
  }

  async isAvailable() {
    return !!(this.secretId && this.secretKey);
  }

  async recognize(imageBuffer, options = {}) {
    if (!this.secretId || !this.secretKey) {
      throw new Error('腾讯 OCR Secret ID/Key 未配置');
    }

    // 腾讯云 OCR 需要 HMAC 签名，这里使用简化版本
    // 实际使用时需要安装 tencentcloud-sdk-nodejs
    const tencentcloud = require('tencentcloud-sdk-nodejs-ocr');
    const OcrClient = tencentcloud.ocr.v20181119.Client;

    const client = new OcrClient({
      credential: {
        secretId: this.secretId,
        secretKey: this.secretKey
      },
      region: this.region,
      profile: {
        httpProfile: {
          endpoint: 'ocr.tencentcloudapi.com'
        }
      }
    });

    try {
      const base64Image = imageBuffer.toString('base64');
      
      const response = await client.GeneralAccurateOCR({
        ImageBase64: base64Image
      });

      const text = response.TextDetections
        .map(item => item.DetectedText)
        .join('\n');

      return {
        success: true,
        engine: this.name,
        text,
        textDetections: response.TextDetections,
        confidence: 0.9
      };
    } catch (error) {
      throw new Error(`腾讯 OCR 识别失败: ${error.message}`);
    }
  }
}

/**
 * OCR 服务管理器
 */
class OCRService {
  constructor() {
    this.engines = new Map();
    this.defaultEngine = OCR_ENGINE.PADDLEOCR;
  }

  /**
   * 注册 OCR 引擎
   */
  registerEngine(engine) {
    this.engines.set(engine.name, engine);
  }

  /**
   * 获取引擎
   */
  getEngine(engineName) {
    return this.engines.get(engineName);
  }

  /**
   * 初始化引擎（根据配置）
   */
  async initializeEngines(config) {
    // 注册 PaddleOCR
    if (config.paddleocr?.enabled !== false) {
      this.registerEngine(new PaddleOCREngine(config.paddleocr || {}));
    }

    // 注册 OpenAI Vision
    if (config.openai_vision?.enabled && config.openai_vision?.apiKey) {
      this.registerEngine(new OpenAIVisionEngine(config.openai_vision));
    }

    // 注册百度 OCR
    if (config.baidu_ocr?.enabled && config.baidu_ocr?.apiKey) {
      this.registerEngine(new BaiduOCREngine(config.baidu_ocr));
    }

    // 注册腾讯 OCR
    if (config.tencent_ocr?.enabled && config.tencent_ocr?.secretId) {
      this.registerEngine(new TencentOCREngine(config.tencent_ocr));
    }

    // 设置默认引擎
    if (config.defaultEngine && this.engines.has(config.defaultEngine)) {
      this.defaultEngine = config.defaultEngine;
    }
  }

  /**
   * 执行 OCR 识别
   */
  async recognize(imageBuffer, options = {}) {
    const engineName = options.engine || this.defaultEngine;
    const engine = this.engines.get(engineName);

    if (!engine) {
      throw new Error(`OCR 引擎 '${engineName}' 未注册`);
    }

    // 检查引擎是否可用
    const available = await engine.isAvailable();
    if (!available) {
      throw new Error(`OCR 引擎 '${engineName}' 不可用，请检查配置`);
    }

    return await engine.recognize(imageBuffer, options);
  }

  /**
   * 获取可用的引擎列表
   */
  async getAvailableEngines() {
    const available = [];
    for (const [name, engine] of this.engines) {
      const isAvailable = await engine.isAvailable();
      available.push({
        name,
        available: isAvailable
      });
    }
    return available;
  }
}

// 导出单例
const ocrService = new OCRService();

module.exports = {
  ocrService,
  OCR_ENGINE,
  BaseOCREngine,
  PaddleOCREngine,
  OpenAIVisionEngine,
  BaiduOCREngine,
  TencentOCREngine
};
