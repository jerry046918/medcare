const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { MedicalReport, FamilyMember, ReportIndicatorData, MedicalIndicator, MedicalLog, sequelize } = require('../models');
const accessService = require('./accessService');
const HttpError = require('../utils/httpError');
const { sanitizeInput, escapeHtml, validateId, validateDate } = require('../utils/security');

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
 * 解析 multipart/JSON 中的指标数据（前端以 JSON 字符串提交）
 */
function parseIndicatorData(body) {
  if (!body.indicatorData) return null;
  return typeof body.indicatorData === 'string'
    ? JSON.parse(body.indicatorData)
    : body.indicatorData;
}

/**
 * 添加 familyMemberId 字段以兼容前端
 */
function withCompatFields(reportData) {
  reportData.familyMemberId = reportData.memberId;
  return reportData;
}

/**
 * v2 权限门禁：assertAccess 404（成员不存在/不可见）映射回各动词的 v1 文案保持兼容；
 * 403（无对应权限级别）原样抛出
 */
async function assertReportAccess(userId, memberId, level, notFoundMessage) {
  try {
    await accessService.assertAccess(userId, memberId, level);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new HttpError(404, notFoundMessage);
    }
    throw error;
  }
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
// 注意：路径锚定在 server 根目录（与拆分前 routes/ 版本解析出的绝对路径一致）；
// multer 对函数式 destination 不会自动建目录，部署时需保证 uploads/reports 存在。
const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/reports');
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

// 获取所有报告（v2：按可见成员 ids 过滤，admin 见全部）
async function listByUser(userId) {
  const visibleIds = await accessService.getVisibleMemberIds(userId);
  const reports = await MedicalReport.findAll({
    where: { memberId: visibleIds },
    include: [
      {
        model: FamilyMember,
        as: 'familyMember',
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
  return reports.map(report => {
    const reportData = report.toJSON();
    reportData.familyMemberId = reportData.memberId;
    reportData.indicatorCount = reportData.indicatorData ? reportData.indicatorData.length : 0;
    // 删除 indicatorData 以减少响应大小
    delete reportData.indicatorData;
    return reportData;
  });
}

// 获取单个报告详情
async function getById(userId, id) {
  // 验证 ID
  const reportId = validateId(id);
  if (!reportId) {
    throw new HttpError(400, '无效的报告ID');
  }

  const report = await MedicalReport.findOne({
    where: { id: reportId },
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
    ]
  });

  if (!report) {
    throw new HttpError(404, '报告不存在');
  }

  await assertReportAccess(userId, report.memberId, 'view', '报告不存在');

  return withCompatFields(report.toJSON());
}

// 创建报告
async function create(userId, body, file) {
  const { familyMemberId, reportDate, hospitalName, doctorName, notes } = body;
  const indicatorData = parseIndicatorData(body) || [];

  // 验证必填字段
  const validFamilyMemberId = validateId(familyMemberId);
  if (!validFamilyMemberId) {
    throw new HttpError(400, '无效的家庭成员ID');
  }

  if (!reportDate || !validateDate(reportDate)) {
    throw new HttpError(400, '无效的报告日期');
  }

  // 消毒文本字段
  const sanitizedData = sanitizeReportData({
    hospitalName,
    doctorName,
    notes
  });

  const transactionResult = await withTransaction(async (transaction) => {
    // v2：成员需对当前用户具备 edit 权限（self/owner/editor/admin）
    await assertReportAccess(userId, validFamilyMemberId, 'edit', '家庭成员不存在或无权限访问');

    // 创建报告
    const report = await MedicalReport.create({
      memberId: validFamilyMemberId,
      reportDate,
      hospitalName: sanitizedData.hospitalName,
      doctorName: sanitizedData.doctorName,
      notes: sanitizedData.notes,
      filePath: file ? `uploads/reports/${file.filename}` : null,
      fileName: file ? file.originalname : null
    }, { transaction });

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
        }
      }

      const indicatorDataToCreate = deduplicatedData.map(item => ({
        reportId: report.id,
        indicatorId: item.indicatorId,
        value: sanitizeInput(String(item.value), { maxLength: 100, stripTags: false }),
        referenceRange: item.referenceRange ? sanitizeInput(item.referenceRange, { maxLength: 50 }) : null,
        isNormal: item.isNormal !== undefined ? Boolean(item.isNormal) : true,
        abnormalType: sanitizeInput(item.abnormalType || 'normal', { maxLength: 20 }),
        notes: item.notes ? sanitizeInput(item.notes, { maxLength: 500 }) : null
      }));

      await ReportIndicatorData.bulkCreate(indicatorDataToCreate, { transaction });
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

    const fullReportData = withCompatFields(fullReport.toJSON());

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

    return fullReportData;
  });

  if (!transactionResult.success) {
    const error = transactionResult.error;
    console.error('[Reports API] 创建报告失败:', error);
    throw new HttpError(error.statusCode || error.status || 500, error.message || '创建报告失败');
  }

  return transactionResult.result;
}

// 更新报告
async function update(userId, id, body, file) {
  // 验证 ID
  const reportId = validateId(id);
  if (!reportId) {
    throw new HttpError(400, '无效的报告ID');
  }

  const { reportDate, hospitalName, doctorName, notes } = body;
  const indicatorData = parseIndicatorData(body);

  // 验证日期（如果提供）
  if (reportDate && !validateDate(reportDate)) {
    throw new HttpError(400, '无效的报告日期');
  }

  const report = await MedicalReport.findOne({
    where: { id: reportId }
  });

  if (!report) {
    throw new HttpError(404, '报告不存在或无权限访问');
  }

  // v2：成员需对当前用户具备 edit 权限
  await assertReportAccess(userId, report.memberId, 'edit', '报告不存在或无权限访问');

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

    if (file) {
      updateFields.filePath = `uploads/reports/${file.filename}`;
      updateFields.fileName = file.originalname;
    }

    await report.update(updateFields, { transaction });

    if (file && oldFilePath) {
      const fullPath = path.join(__dirname, '../..', oldFilePath);
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

    return withCompatFields(updatedReport.toJSON());
  });

  if (!transactionResult.success) {
    console.error('更新报告失败:', transactionResult.error);
    throw new HttpError(500, '更新报告失败');
  }

  return transactionResult.result;
}

// 删除报告
async function remove(userId, id) {
  // 验证 ID
  const reportId = validateId(id);
  if (!reportId) {
    throw new HttpError(400, '无效的报告ID');
  }

  const report = await MedicalReport.findOne({
    where: { id: reportId }
  });

  if (!report) {
    throw new HttpError(404, '报告不存在或无权限访问');
  }

  // v2：删除需要成员 edit 权限
  await assertReportAccess(userId, report.memberId, 'edit', '报告不存在或无权限访问');

  // 删除关联的指标数据
  await ReportIndicatorData.destroy({
    where: { reportId: reportId }
  });

  // 删除关联文件
  if (report.filePath) {
    const filePath = path.join(__dirname, '../..', report.filePath);
    try { await fs.unlink(filePath); } catch (e) {
      console.warn('[Reports] Failed to delete report file:', e.message);
    }
  }

  // 删除报告
  await report.destroy();
}

module.exports = { listByUser, getById, create, update, remove, reportUpload };
