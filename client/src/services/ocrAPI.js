/**
 * OCR API 服务
 */

import api from './api';

/**
 * 上传图片并进行 OCR 识别
 */
export const uploadAndRecognize = async (file, engine = null) => {
  const formData = new FormData();
  formData.append('image', file);
  if (engine) {
    formData.append('engine', engine);
  }

  const response = await api.post('/ocr/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

/**
 * 解析 OCR 文本，提取指标并匹配
 */
export const parseOCRResult = async (text) => {
  const response = await api.post('/ocr/parse', { text });
  return response.data;
};

/**
 * 上传图片、识别并解析（一站式）
 */
export const recognizeAndParse = async (file, engine = null) => {
  const formData = new FormData();
  formData.append('image', file);
  if (engine) {
    formData.append('engine', engine);
  }

  const response = await api.post('/ocr/recognize-and-parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

/**
 * 创建新指标（从 OCR 提取的未匹配指标）
 * @param {Object} indicatorData - 指标数据
 * @param {Object} extracted - (旧版) OCR 提取的数据
 * @param {string} type - 指标类型
 */
export const createIndicator = async (indicatorDataOrExtracted, type = '血液') => {
  // 兼容两种调用方式
  let payload;
  if (indicatorDataOrExtracted.name) {
    // 新版：直接传递指标数据
    payload = {
      extracted: indicatorDataOrExtracted,
      type: indicatorDataOrExtracted.type || type
    };
  } else {
    // 旧版：传递 extracted 对象
    payload = { extracted: indicatorDataOrExtracted, type };
  }
  
  const response = await api.post('/ocr/create-indicator', payload);
  return response.data;
};

/**
 * 获取可用的 OCR 引擎列表
 */
export const getAvailableEngines = async () => {
  const response = await api.get('/ocr/engines');
  return response.data;
};

/**
 * 获取 OCR 配置（公开部分）
 */
export const getOCRConfig = async () => {
  const response = await api.get('/ocr/config');
  return response.data;
};

/**
 * 确认指标匹配（自动学习别名）
 * 当用户手动选择指标时调用，系统会自动将 OCR 识别的名称添加为该指标的别名
 */
export const confirmMatch = async (indicatorId, extractedName, autoAddAlias = true) => {
  const response = await api.post('/ocr/confirm-match', {
    indicatorId,
    extractedName,
    autoAddAlias
  });
  return response.data;
};

export default {
  uploadAndRecognize,
  parseOCRResult,
  recognizeAndParse,
  createIndicator,
  getAvailableEngines,
  getOCRConfig,
  confirmMatch
};
