const { MedicalLog, FamilyMember, MedicalReport, Medication } = require('../models');
const HttpError = require('../utils/httpError');
const { sanitizeInput, escapeHtml } = require('../utils/security');

function sanitizeLogData(data) {
  const sanitized = { ...data };
  if (sanitized.title) sanitized.title = escapeHtml(sanitizeInput(sanitized.title, { maxLength: 200 }));
  if (sanitized.description) sanitized.description = escapeHtml(sanitizeInput(sanitized.description, { maxLength: 2000 }));
  if (sanitized.hospital) sanitized.hospital = escapeHtml(sanitizeInput(sanitized.hospital, { maxLength: 200 }));
  return sanitized;
}

// 获取指定成员的所有医疗日志
async function listByMember(userId, memberId) {
  try {
    // 验证家庭成员属于当前用户
    const familyMember = await FamilyMember.findOne({
      where: {
        id: memberId,
        userId
      }
    });

    if (!familyMember) {
      throw new HttpError(404, '家庭成员不存在或无权限访问');
    }

    return await MedicalLog.findAll({
      where: { memberId },
      include: [
        {
          model: MedicalReport,
          as: 'relatedReport',
          attributes: ['id', 'reportDate', 'hospitalName']
        },
        {
          model: Medication,
          as: 'relatedMedication',
          attributes: ['id', 'name', 'specification']
        }
      ],
      // 先按治疗开始时间降序，再按创建时间降序
      order: [
        ['treatmentStartDate', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('获取医疗日志失败:', error);
    throw new HttpError(500, '获取医疗日志失败', error.message);
  }
}

// 获取单个医疗日志
async function getById(userId, id) {
  try {
    const log = await MedicalLog.findOne({
      where: { id },
      include: [
        {
          model: FamilyMember,
          as: 'familyMember',
          where: { userId }
        },
        {
          model: MedicalReport,
          as: 'relatedReport',
          attributes: ['id', 'reportDate', 'hospitalName']
        },
        {
          model: Medication,
          as: 'relatedMedication',
          attributes: ['id', 'name', 'specification']
        }
      ]
    });

    if (!log) {
      throw new HttpError(404, '医疗日志不存在或无权限访问');
    }

    return log;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('获取医疗日志详情失败:', error);
    throw new HttpError(500, '获取医疗日志详情失败', error.message);
  }
}

// 创建手动医疗日志
async function create(userId, body) {
  try {
    const sanitized = sanitizeLogData(body);
    const { memberId, logType, title, description, hospital, treatmentStartDate, treatmentEndDate } = sanitized;

    // 验证必填字段
    if (!memberId || !logType || !title) {
      throw new HttpError(400, '家庭成员、行为类型和标题为必填字段');
    }

    // 验证logType必须是手动类型
    const manualTypes = ['hospitalization', 'outpatient', 'emergency'];
    if (!manualTypes.includes(logType)) {
      throw new HttpError(400, '手动日志类型必须是：住院治疗、门诊治疗或急诊治疗');
    }

    // 验证家庭成员是否属于当前用户
    const familyMember = await FamilyMember.findOne({
      where: {
        id: memberId,
        userId
      }
    });

    if (!familyMember) {
      throw new HttpError(404, '家庭成员不存在或无权限访问');
    }

    // 处理日期
    const treatmentStart = treatmentStartDate ? new Date(treatmentStartDate) : new Date();
    const treatmentEnd = treatmentEndDate ? new Date(treatmentEndDate) : null;
    const logDate = treatmentStartDate ? new Date(treatmentStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const log = await MedicalLog.create({
      memberId,
      logType,
      title,
      description: description || null,
      hospital: hospital || null,
      treatmentStartDate: treatmentStart,
      treatmentEndDate: treatmentEnd,
      logDate,
      relatedReportId: null,
      relatedMedicationId: null
    });

    // 返回完整的日志信息
    return await MedicalLog.findOne({
      where: { id: log.id },
      include: [
        {
          model: FamilyMember,
          as: 'familyMember',
          attributes: ['id', 'name']
        },
        {
          model: MedicalReport,
          as: 'relatedReport',
          attributes: ['id', 'reportDate', 'hospitalName']
        },
        {
          model: Medication,
          as: 'relatedMedication',
          attributes: ['id', 'name', 'specification']
        }
      ]
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('创建医疗日志失败:', error);
    throw new HttpError(500, '创建医疗日志失败', error.message);
  }
}

// 更新医疗日志
async function update(userId, id, body) {
  try {
    const sanitized = sanitizeLogData(body);
    const { title, description, hospital, treatmentStartDate, treatmentEndDate } = sanitized;

    const log = await MedicalLog.findOne({
      where: { id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId }
      }]
    });

    if (!log) {
      throw new HttpError(404, '医疗日志不存在或无权限访问');
    }

    // 只允许编辑手动添加的日志
    const manualTypes = ['hospitalization', 'outpatient', 'emergency'];
    if (!manualTypes.includes(log.logType)) {
      throw new HttpError(400, '系统自动生成的日志不能编辑');
    }

    const updateData = {
      title: title || log.title,
      description: description !== undefined ? description : log.description,
      hospital: hospital !== undefined ? hospital : log.hospital
    };

    if (treatmentStartDate) {
      updateData.treatmentStartDate = new Date(treatmentStartDate);
      updateData.logDate = new Date(treatmentStartDate).toISOString().split('T')[0];
    }

    if (treatmentEndDate !== undefined) {
      updateData.treatmentEndDate = treatmentEndDate ? new Date(treatmentEndDate) : null;
    }

    await log.update(updateData);

    return log;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('更新医疗日志失败:', error);
    throw new HttpError(500, '更新医疗日志失败', error.message);
  }
}

// 删除医疗日志
async function remove(userId, id) {
  try {
    const log = await MedicalLog.findOne({
      where: { id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId }
      }]
    });

    if (!log) {
      throw new HttpError(404, '医疗日志不存在或无权限访问');
    }

    // 只允许删除手动添加的日志
    const manualTypes = ['hospitalization', 'outpatient', 'emergency'];
    if (!manualTypes.includes(log.logType)) {
      throw new HttpError(400, '系统自动生成的日志不能删除');
    }

    await log.destroy();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('删除医疗日志失败:', error);
    throw new HttpError(500, '删除医疗日志失败', error.message);
  }
}

module.exports = { listByMember, getById, create, update, remove };
