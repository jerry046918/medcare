const { MedicalIndicator, ReportIndicatorData } = require('../models');
const HttpError = require('../utils/httpError');
const { sanitizeInput, escapeHtml } = require('../utils/security');

function sanitizeIndicatorData(data) {
  const sanitized = { ...data };
  if (sanitized.name) sanitized.name = escapeHtml(sanitizeInput(sanitized.name, { maxLength: 100 }));
  if (sanitized.unit) sanitized.unit = escapeHtml(sanitizeInput(sanitized.unit, { maxLength: 50 }));
  if (sanitized.type) sanitized.type = escapeHtml(sanitizeInput(sanitized.type, { maxLength: 50 }));
  if (sanitized.testMethod) sanitized.testMethod = escapeHtml(sanitizeInput(sanitized.testMethod, { maxLength: 100 }));
  if (sanitized.referenceRange) sanitized.referenceRange = escapeHtml(sanitizeInput(sanitized.referenceRange, { maxLength: 200 }));
  if (sanitized.description) sanitized.description = escapeHtml(sanitizeInput(sanitized.description, { maxLength: 500 }));
  return sanitized;
}

// 获取所有指标
async function list() {
  try {
    return await MedicalIndicator.findAll({
      order: [['isDefault', 'DESC'], ['name', 'ASC']]
    });
  } catch (error) {
    console.error('获取指标列表失败:', error);
    throw new HttpError(500, '获取指标列表失败', error.message);
  }
}

// 获取单个指标详情
async function getById(id) {
  try {
    const indicator = await MedicalIndicator.findByPk(id);

    if (!indicator) {
      throw new HttpError(404, '指标不存在');
    }

    return indicator;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('获取指标详情失败:', error);
    throw new HttpError(500, '获取指标详情失败', error.message);
  }
}

// 创建指标
async function create(body) {
  try {
    const sanitized = sanitizeIndicatorData(body);
    const {
      name,
      unit,
      type,
      valueType,
      normalMin,
      normalMax,
      normalMinFemale,
      normalMaxFemale,
      normalValue,
      testMethod,
      referenceRange,
      description,
      isDefault
    } = sanitized;

    // 验证必填字段
    if (!name || !type || !valueType) {
      throw new HttpError(400, '指标名称、类型和值类型为必填字段');
    }

    // 验证数值型指标的正常范围（至少需要填写一个边界值）
    if (valueType === 'numeric' && normalMin === undefined && normalMax === undefined) {
      throw new HttpError(400, '数值型指标至少需要设置最小值或最大值其中之一');
    }

    if (normalMin !== undefined && normalMax !== undefined && Number(normalMin) >= Number(normalMax)) {
      throw new HttpError(400, '最小正常值必须小于最大正常值');
    }

    // 验证定性型指标的正常值
    if (valueType === 'qualitative' && !normalValue) {
      throw new HttpError(400, '定性型指标必须设置正常值');
    }

    return await MedicalIndicator.create({
      name,
      unit: unit || null,
      type,
      valueType,
      normalMin: valueType === 'numeric' ? normalMin : null,
      normalMax: valueType === 'numeric' ? normalMax : null,
      normalMinFemale: valueType === 'numeric' ? normalMinFemale : null,
      normalMaxFemale: valueType === 'numeric' ? normalMaxFemale : null,
      normalValue: valueType === 'qualitative' ? normalValue : null,
      testMethod: testMethod || null,
      referenceRange: referenceRange || null,
      description: description || null,
      isDefault: isDefault || false
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('创建指标失败:', error);
    throw new HttpError(500, '创建指标失败', error.message);
  }
}

// 更新指标
async function update(id, body) {
  try {
    const sanitized = sanitizeIndicatorData(body);
    const {
      name,
      unit,
      type,
      valueType,
      normalMin,
      normalMax,
      normalMinFemale,
      normalMaxFemale,
      normalValue,
      testMethod,
      referenceRange,
      description,
      isDefault
    } = sanitized;

    const indicator = await MedicalIndicator.findByPk(id);

    if (!indicator) {
      throw new HttpError(404, '指标不存在');
    }

    // 如果更新了值类型，验证相应的正常值字段
    const newValueType = valueType || indicator.valueType;
    if (valueType && valueType !== indicator.valueType) {
      if (valueType === 'numeric' && normalMin === undefined && normalMax === undefined) {
        throw new HttpError(400, '数值型指标至少需要设置最小值或最大值其中之一');
      }
      if (valueType === 'qualitative' && !normalValue) {
        throw new HttpError(400, '定性型指标必须设置正常值');
      }
    }

    if (normalMin !== undefined && normalMax !== undefined && Number(normalMin) >= Number(normalMax)) {
      throw new HttpError(400, '最小正常值必须小于最大正常值');
    }

    await indicator.update({
      name: name || indicator.name,
      unit: unit !== undefined ? unit : indicator.unit,
      type: type || indicator.type,
      valueType: valueType || indicator.valueType,
      normalMin: newValueType === 'numeric' ? (normalMin !== undefined ? normalMin : indicator.normalMin) : null,
      normalMax: newValueType === 'numeric' ? (normalMax !== undefined ? normalMax : indicator.normalMax) : null,
      normalMinFemale: newValueType === 'numeric' ? (normalMinFemale !== undefined ? normalMinFemale : indicator.normalMinFemale) : null,
      normalMaxFemale: newValueType === 'numeric' ? (normalMaxFemale !== undefined ? normalMaxFemale : indicator.normalMaxFemale) : null,
      normalValue: newValueType === 'qualitative' ? (normalValue !== undefined ? normalValue : indicator.normalValue) : null,
      testMethod: testMethod !== undefined ? testMethod : indicator.testMethod,
      referenceRange: referenceRange !== undefined ? referenceRange : indicator.referenceRange,
      description: description !== undefined ? description : indicator.description,
      isDefault: isDefault !== undefined ? isDefault : indicator.isDefault
    });

    return indicator;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('更新指标失败:', error);
    throw new HttpError(500, '更新指标失败', error.message);
  }
}

// 删除指标
async function remove(id) {
  try {
    const indicator = await MedicalIndicator.findByPk(id);

    if (!indicator) {
      throw new HttpError(404, '指标不存在');
    }

    // 检查是否为默认指标
    if (indicator.isDefault) {
      throw new HttpError(400, '无法删除系统默认指标');
    }

    // 检查是否有关联的报告数据
    const reportDataCount = await ReportIndicatorData.count({
      where: { indicatorId: id }
    });
    if (reportDataCount > 0) {
      throw new HttpError(400, `无法删除该指标，因为存在 ${reportDataCount} 条关联的报告数据`);
    }

    await indicator.destroy();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('删除指标失败:', error);
    throw new HttpError(500, '删除指标失败', error.message);
  }
}

/**
 * POST /api/indicators/:id/alias
 * 为指标添加别名（用于 OCR 识别匹配）
 */
async function addAlias(id, body) {
  try {
    const { alias, aliases } = body;
    const indicator = await MedicalIndicator.findByPk(id);

    if (!indicator) {
      throw new HttpError(404, '指标不存在');
    }

    // 获取现有别名
    let currentAliases = indicator.aliases || [];

    // 支持单个别名或批量添加
    let aliasesToAdd = [];
    if (aliases && Array.isArray(aliases)) {
      aliasesToAdd = aliases;
    } else if (alias) {
      aliasesToAdd = [alias];
    }

    // 过滤掉空值和重复值
    aliasesToAdd = aliasesToAdd
      .map(a => a.trim())
      .filter(a => a && !currentAliases.includes(a) && a !== indicator.name);

    if (aliasesToAdd.length === 0) {
      return { noNewAliases: true, indicator };
    }

    // 合并别名
    const newAliases = [...currentAliases, ...aliasesToAdd];
    await indicator.update({ aliases: newAliases });

    return {
      addedCount: aliasesToAdd.length,
      data: {
        id: indicator.id,
        name: indicator.name,
        aliases: newAliases,
        addedAliases: aliasesToAdd
      }
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('添加别名失败:', error);
    throw new HttpError(500, '添加别名失败', error.message);
  }
}

/**
 * DELETE /api/indicators/:id/alias
 * 删除指标的某个别名
 */
async function removeAlias(id, body) {
  try {
    const { alias } = body;
    const indicator = await MedicalIndicator.findByPk(id);

    if (!indicator) {
      throw new HttpError(404, '指标不存在');
    }

    if (!alias) {
      throw new HttpError(400, '请提供要删除的别名');
    }

    // 获取现有别名并移除指定的别名
    const currentAliases = indicator.aliases || [];
    const newAliases = currentAliases.filter(a => a !== alias.trim());

    if (newAliases.length === currentAliases.length) {
      throw new HttpError(404, '未找到该别名');
    }

    await indicator.update({ aliases: newAliases });

    return {
      id: indicator.id,
      name: indicator.name,
      aliases: newAliases
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('删除别名失败:', error);
    throw new HttpError(500, '删除别名失败', error.message);
  }
}

module.exports = { list, getById, create, update, remove, addAlias, removeAlias };
