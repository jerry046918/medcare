const express = require('express');
const { MedicalIndicator, ReportIndicatorData } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, escapeHtml } = require('../utils/security');
const router = express.Router();

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
router.get('/', authenticateToken, async (req, res) => {
  try {
    const indicators = await MedicalIndicator.findAll({
      order: [['isDefault', 'DESC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      data: indicators
    });
  } catch (error) {
    console.error('获取指标列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取指标列表失败',
      error: error.message
    });
  }
});

// 获取单个指标详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const indicator = await MedicalIndicator.findByPk(req.params.id);

    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: '指标不存在'
      });
    }

    res.json({
      success: true,
      data: indicator
    });
  } catch (error) {
    console.error('获取指标详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取指标详情失败',
      error: error.message
    });
  }
});

// 创建指标
router.post('/', authenticateToken, async (req, res) => {
  try {
    const sanitized = sanitizeIndicatorData(req.body);
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
      return res.status(400).json({
        success: false,
        message: '指标名称、类型和值类型为必填字段'
      });
    }

    // 验证数值型指标的正常范围（至少需要填写一个边界值）
    if (valueType === 'numeric' && normalMin === undefined && normalMax === undefined) {
      return res.status(400).json({
        success: false,
        message: '数值型指标至少需要设置最小值或最大值其中之一'
      });
    }

    if (normalMin !== undefined && normalMax !== undefined && Number(normalMin) >= Number(normalMax)) {
      return res.status(400).json({
        success: false,
        message: '最小正常值必须小于最大正常值'
      });
    }

    // 验证定性型指标的正常值
    if (valueType === 'qualitative' && !normalValue) {
      return res.status(400).json({
        success: false,
        message: '定性型指标必须设置正常值'
      });
    }

    const indicator = await MedicalIndicator.create({
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

    res.status(201).json({
      success: true,
      message: '指标创建成功',
      data: indicator
    });
  } catch (error) {
    console.error('创建指标失败:', error);
    res.status(500).json({
      success: false,
      message: '创建指标失败',
      error: error.message
    });
  }
});

// 更新指标
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const sanitized = sanitizeIndicatorData(req.body);
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

    const indicator = await MedicalIndicator.findByPk(req.params.id);

    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: '指标不存在'
      });
    }

    // 如果更新了值类型，验证相应的正常值字段
    const newValueType = valueType || indicator.valueType;
    if (valueType && valueType !== indicator.valueType) {
      if (valueType === 'numeric' && normalMin === undefined && normalMax === undefined) {
        return res.status(400).json({
          success: false,
          message: '数值型指标至少需要设置最小值或最大值其中之一'
        });
      }
      if (valueType === 'qualitative' && !normalValue) {
        return res.status(400).json({
          success: false,
          message: '定性型指标必须设置正常值'
        });
      }
    }

    if (normalMin !== undefined && normalMax !== undefined && Number(normalMin) >= Number(normalMax)) {
      return res.status(400).json({
        success: false,
        message: '最小正常值必须小于最大正常值'
      });
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

    res.json({
      success: true,
      message: '指标更新成功',
      data: indicator
    });
  } catch (error) {
    console.error('更新指标失败:', error);
    res.status(500).json({
      success: false,
      message: '更新指标失败',
      error: error.message
    });
  }
});

// 删除指标
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const indicator = await MedicalIndicator.findByPk(req.params.id);

    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: '指标不存在'
      });
    }

    // 检查是否为默认指标
    if (indicator.isDefault) {
      return res.status(400).json({
        success: false,
        message: '无法删除系统默认指标'
      });
    }

    // 检查是否有关联的报告数据
    const reportDataCount = await ReportIndicatorData.count({
      where: { indicatorId: req.params.id }
    });
    if (reportDataCount > 0) {
      return res.status(400).json({
        success: false,
        message: `无法删除该指标，因为存在 ${reportDataCount} 条关联的报告数据`
      });
    }

    await indicator.destroy();

    res.json({
      success: true,
      message: '指标删除成功'
    });
  } catch (error) {
    console.error('删除指标失败:', error);
    res.status(500).json({
      success: false,
      message: '删除指标失败',
      error: error.message
    });
  }
});

/**
 * POST /api/indicators/:id/alias
 * 为指标添加别名（用于 OCR 识别匹配）
 */
router.post('/:id/alias', authenticateToken, async (req, res) => {
  try {
    const { alias, aliases } = req.body;
    const indicator = await MedicalIndicator.findByPk(req.params.id);

    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: '指标不存在'
      });
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
      return res.json({
        success: true,
        message: '没有需要添加的新别名',
        data: indicator
      });
    }

    // 合并别名
    const newAliases = [...currentAliases, ...aliasesToAdd];
    await indicator.update({ aliases: newAliases });

    res.json({
      success: true,
      message: `成功添加 ${aliasesToAdd.length} 个别名`,
      data: {
        id: indicator.id,
        name: indicator.name,
        aliases: newAliases,
        addedAliases: aliasesToAdd
      }
    });
  } catch (error) {
    console.error('添加别名失败:', error);
    res.status(500).json({
      success: false,
      message: '添加别名失败',
      error: error.message
    });
  }
});

/**
 * DELETE /api/indicators/:id/alias
 * 删除指标的某个别名
 */
router.delete('/:id/alias', authenticateToken, async (req, res) => {
  try {
    const { alias } = req.body;
    const indicator = await MedicalIndicator.findByPk(req.params.id);

    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: '指标不存在'
      });
    }

    if (!alias) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的别名'
      });
    }

    // 获取现有别名并移除指定的别名
    const currentAliases = indicator.aliases || [];
    const newAliases = currentAliases.filter(a => a !== alias.trim());

    if (newAliases.length === currentAliases.length) {
      return res.status(404).json({
        success: false,
        message: '未找到该别名'
      });
    }

    await indicator.update({ aliases: newAliases });

    res.json({
      success: true,
      message: '别名删除成功',
      data: {
        id: indicator.id,
        name: indicator.name,
        aliases: newAliases
      }
    });
  } catch (error) {
    console.error('删除别名失败:', error);
    res.status(500).json({
      success: false,
      message: '删除别名失败',
      error: error.message
    });
  }
});

module.exports = router;