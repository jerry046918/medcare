const express = require('express');
const { MedicalReport, FamilyMember, ReportIndicatorData, MedicalIndicator, MedicalLog, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, escapeHtml, validateId, validateDate } = require('../utils/security');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

/**
 * 消毒报告数据
 */
function sanitizeReportData(data) {
  const sanitized = { ...data };

  if (sanitized.hospitalName) {
    sanitized.hospitalName = escapeHtml(sanitizeInput(sanitized.hospitalName, { maxLength: 100 }));
  }
  if (sanitized.doctorName) {
    sanitized.doctorName = escapeHtml(sanitizeInput(sanitized.doctorName, { maxLength: 50 }));
  }
  if (sanitized.notes) {
    sanitized.notes = escapeHtml(sanitizeInput(sanitized.notes, { maxLength: 1000 }));
  }

  return sanitized;
}

/**
 * 安全的事务包装器
 */
async function withTransaction(callback) {
  const transaction = await sequelize.transaction();
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return { success: true, result };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('[Transaction] 回滚失败:', rollbackError);
      // 即使回滚失败也继续抛出原始错误
    }
    return { success: false, error };
  }
}

// Report file upload configuration
const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/reports');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf'];
    if (!safeExts.includes(ext)) {
      return cb(new Error('不支持的文件类型'));
    }
    const safeName = `report-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, safeName);
  }
});

const reportUpload = multer({
  storage: reportStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// 获取所有报告
router.get('/', authenticateToken, async (req, res) => {
  try {
    const reports = await MedicalReport.findAll({
      include: [
        {
          model: FamilyMember,
          as: 'familyMember',
          where: { userId: req.user.id },
          attributes: ['id', 'name', 'gender']
        },
        {
          model: ReportIndicatorData,
          as: 'indicatorData',
          attributes: ['id'] // 只需要id来计算数量
        }
      ],
      order: [['reportDate', 'DESC']]
    });

    // 添加 familyMemberId 和 indicatorCount 字段以兼容前端
    const reportsWithFamilyMemberId = reports.map(report => {
      const reportData = report.toJSON();
      reportData.familyMemberId = reportData.memberId;
      reportData.indicatorCount = reportData.indicatorData ? reportData.indicatorData.length : 0;
      // 删除 indicatorData 以减少响应大小
      delete reportData.indicatorData;
      return reportData;
    });

    res.json({
      success: true,
      data: reportsWithFamilyMemberId
    });
  } catch (error) {
    console.error('获取报告列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取报告列表失败'
    });
  }
});

// 获取单个报告详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // 验证 ID
    const reportId = validateId(req.params.id);
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: '无效的报告ID'
      });
    }

    const report = await MedicalReport.findOne({
      where: { id: reportId },
      include: [
        {
          model: FamilyMember,
          as: 'familyMember',
          where: { userId: req.user.id },
          attributes: ['id', 'name', 'gender']
        },
        {
          model: ReportIndicatorData,
          as: 'indicatorData',
          include: [{
            model: MedicalIndicator,
            as: 'indicator'
          }]
        }
      ]
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报告不存在'
      });
    }

    // 添加 familyMemberId 字段以兼容前端
    const reportData = report.toJSON();
    reportData.familyMemberId = reportData.memberId;

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('获取报告详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取报告详情失败'
    });
  }
});

// 创建报告
router.post('/', authenticateToken, reportUpload.single('file'), async (req, res) => {
  const { familyMemberId, reportDate, hospitalName, doctorName, notes } = req.body;
  const indicatorData = req.body.indicatorData
    ? (typeof req.body.indicatorData === 'string'
      ? JSON.parse(req.body.indicatorData)
      : req.body.indicatorData)
    : [];

  // 验证必填字段
  const validFamilyMemberId = validateId(familyMemberId);
  if (!validFamilyMemberId) {
    return res.status(400).json({
      success: false,
      message: '无效的家庭成员ID'
    });
  }

  if (!reportDate || !validateDate(reportDate)) {
    return res.status(400).json({
      success: false,
      message: '无效的报告日期'
    });
  }

  // 消毒文本字段
  const sanitizedData = sanitizeReportData({
    hospitalName,
    doctorName,
    notes
  });

  console.log('[Reports API] 收到创建报告请求:', {
    familyMemberId: validFamilyMemberId,
    reportDate,
    hospitalName: sanitizedData.hospitalName,
    indicatorCount: indicatorData?.length || 0
  });

  const transactionResult = await withTransaction(async (transaction) => {
    // 验证家庭成员是否属于当前用户
    const familyMember = await FamilyMember.findOne({
      where: {
        id: validFamilyMemberId,
        userId: req.user.id
      },
      transaction
    });

    if (!familyMember) {
      const error = new Error('家庭成员不存在或无权限访问');
      error.statusCode = 404;
      throw error;
    }

    // 创建报告
    const report = await MedicalReport.create({
      memberId: validFamilyMemberId,
      reportDate,
      hospitalName: sanitizedData.hospitalName,
      doctorName: sanitizedData.doctorName,
      notes: sanitizedData.notes,
      filePath: req.file ? `uploads/reports/${req.file.filename}` : null,
      fileName: req.file ? req.file.originalname : null
    }, { transaction });

    console.log('[Reports API] 报告创建成功, ID:', report.id);

    // 创建指标数据
    if (indicatorData && Array.isArray(indicatorData) && indicatorData.length > 0) {
      // 去重：每个 indicatorId 只保留第一条记录
      const seenIndicatorIds = new Set();
      const deduplicatedData = [];

      for (const item of indicatorData) {
        const validIndicatorId = validateId(item.indicatorId);
        if (validIndicatorId && !seenIndicatorIds.has(validIndicatorId)) {
          seenIndicatorIds.add(validIndicatorId);
          deduplicatedData.push({
            ...item,
            indicatorId: validIndicatorId
          });
        } else if (validIndicatorId) {
          console.log('[Reports API] 跳过重复指标:', validIndicatorId);
        }
      }

      console.log('[Reports API] 原始指标数:', indicatorData.length, '去重后:', deduplicatedData.length);

      const indicatorDataToCreate = deduplicatedData.map(item => ({
        reportId: report.id,
        indicatorId: item.indicatorId,
        value: sanitizeInput(String(item.value), { maxLength: 100, stripTags: false }),
        referenceRange: item.referenceRange ? sanitizeInput(item.referenceRange, { maxLength: 50 }) : null,
        isNormal: item.isNormal !== undefined ? Boolean(item.isNormal) : true,
        abnormalType: sanitizeInput(item.abnormalType || 'normal', { maxLength: 20 }),
        notes: item.notes ? sanitizeInput(item.notes, { maxLength: 500 }) : null
      }));

      console.log('[Reports API] 准备创建指标数据:', indicatorDataToCreate.length, '条');
      const createdIndicators = await ReportIndicatorData.bulkCreate(indicatorDataToCreate, { transaction });
      console.log('[Reports API] 成功创建了', createdIndicators.length, '条指标数据');
    } else {
      console.log('[Reports API] 没有指标数据需要创建');
    }

    // 获取完整的报告数据
    const fullReport = await MedicalReport.findOne({
      where: { id: report.id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        attributes: ['id', 'name', 'gender']
      },
      {
        model: ReportIndicatorData,
        as: 'indicatorData',
        include: [{
          model: MedicalIndicator,
          as: 'indicator'
        }]
      }],
      transaction
    });

    // 添加 familyMemberId 字段以兼容前端
    const fullReportData = fullReport.toJSON();
    fullReportData.familyMemberId = fullReportData.memberId;

    // 自动创建医疗日志
    await MedicalLog.create({
      memberId: validFamilyMemberId,
      logType: 'report',
      title: `新增检查报告 - ${sanitizedData.hospitalName || '未知医院'}`,
      description: `在${sanitizedData.hospitalName || '未知医院'}进行了检查，医生：${sanitizedData.doctorName || '未知'}`,
      hospital: sanitizedData.hospitalName || null,
      relatedReportId: report.id,
      logDate: reportDate,
      treatmentStartDate: reportDate
    }, { transaction });

    console.log('[Reports API] 事务处理完成');
    return fullReportData;
  });

  if (!transactionResult.success) {
    const error = transactionResult.error;
    console.error('[Reports API] 创建报告失败:', error);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || '创建报告失败'
    });
  }

  res.status(201).json({
    success: true,
    message: '报告创建成功',
    data: transactionResult.result
  });
});

// 更新报告
router.put('/:id', authenticateToken, reportUpload.single('file'), async (req, res) => {
  try {
    // 验证 ID
    const reportId = validateId(req.params.id);
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: '无效的报告ID'
      });
    }

    const { reportDate, hospitalName, doctorName, notes } = req.body;
    const indicatorData = req.body.indicatorData
      ? (typeof req.body.indicatorData === 'string'
        ? JSON.parse(req.body.indicatorData)
        : req.body.indicatorData)
      : null;

    // 验证日期（如果提供）
    if (reportDate && !validateDate(reportDate)) {
      return res.status(400).json({
        success: false,
        message: '无效的报告日期'
      });
    }

    const report = await MedicalReport.findOne({
      where: { id: reportId },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId: req.user.id }
      }]
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报告不存在或无权限访问'
      });
    }

    // 消毒输入
    const sanitizedData = sanitizeReportData({
      hospitalName,
      doctorName,
      notes
    });

    // 使用事务保护更新操作（防止 destroy + bulkCreate 中间失败导致数据丢失）
    const transactionResult = await withTransaction(async (transaction) => {
      const oldFilePath = report.filePath;

      const updateFields = {
        reportDate: reportDate || report.reportDate,
        hospitalName: hospitalName !== undefined ? sanitizedData.hospitalName : report.hospitalName,
        doctorName: doctorName !== undefined ? sanitizedData.doctorName : report.doctorName,
        notes: notes !== undefined ? sanitizedData.notes : report.notes
      };

      if (req.file) {
        updateFields.filePath = `uploads/reports/${req.file.filename}`;
        updateFields.fileName = req.file.originalname;
      }

      await report.update(updateFields, { transaction });

      if (req.file && oldFilePath) {
        const fullPath = path.join(__dirname, '..', oldFilePath);
        try { await fs.unlink(fullPath); } catch (e) {
          console.warn('[Reports] Failed to delete old file:', e.message);
        }
      }

      // 更新指标数据
      if (indicatorData && Array.isArray(indicatorData)) {
        // 删除现有的指标数据
        await ReportIndicatorData.destroy({
          where: { reportId: reportId },
          transaction
        });

        // 创建新的指标数据
        if (indicatorData.length > 0) {
          const indicatorDataToCreate = indicatorData.map(item => ({
            reportId: reportId,
            indicatorId: validateId(item.indicatorId),
            value: sanitizeInput(String(item.value), { maxLength: 100, stripTags: false }),
            referenceRange: item.referenceRange ? sanitizeInput(item.referenceRange, { maxLength: 50 }) : null,
            isNormal: item.isNormal !== undefined ? Boolean(item.isNormal) : true,
            abnormalType: sanitizeInput(item.abnormalType || 'normal', { maxLength: 20 }),
            notes: item.notes ? sanitizeInput(item.notes, { maxLength: 500 }) : null
          })).filter(item => item.indicatorId);

          await ReportIndicatorData.bulkCreate(indicatorDataToCreate, { transaction });
        }
      }

      // 获取更新后的完整报告数据
      const updatedReport = await MedicalReport.findOne({
        where: { id: report.id },
        include: [
          {
            model: FamilyMember,
            as: 'familyMember',
            attributes: ['id', 'name', 'gender']
          },
          {
            model: ReportIndicatorData,
            as: 'indicatorData',
            include: [{
              model: MedicalIndicator,
              as: 'indicator'
            }]
          }
        ],
        transaction
      });

      const updatedReportData = updatedReport.toJSON();
      updatedReportData.familyMemberId = updatedReportData.memberId;
      return updatedReportData;
    });

    if (!transactionResult.success) {
      console.error('更新报告失败:', transactionResult.error);
      return res.status(500).json({
        success: false,
        message: '更新报告失败'
      });
    }

    res.json({
      success: true,
      message: '报告更新成功',
      data: transactionResult.result
    });
  } catch (error) {
    console.error('更新报告失败:', error);
    res.status(500).json({
      success: false,
      message: '更新报告失败'
    });
  }
});

// 删除报告
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // 验证 ID
    const reportId = validateId(req.params.id);
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: '无效的报告ID'
      });
    }

    const report = await MedicalReport.findOne({
      where: { id: reportId },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId: req.user.id }
      }]
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报告不存在或无权限访问'
      });
    }

    // 删除关联的指标数据
    await ReportIndicatorData.destroy({
      where: { reportId: reportId }
    });

    // 删除关联文件
    if (report.filePath) {
      const filePath = path.join(__dirname, '..', report.filePath);
      try { await fs.unlink(filePath); } catch (e) {
        console.warn('[Reports] Failed to delete report file:', e.message);
      }
    }

    // 删除报告
    await report.destroy();

    res.json({
      success: true,
      message: '报告删除成功'
    });
  } catch (error) {
    console.error('删除报告失败:', error);
    res.status(500).json({
      success: false,
      message: '删除报告失败'
    });
  }
});

module.exports = router;
