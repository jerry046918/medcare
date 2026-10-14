const { Medication, FamilyMember, MedicalLog } = require('../models');
const HttpError = require('../utils/httpError');
const { sanitizeInput, escapeHtml } = require('../utils/security');

function sanitizeMedicationData(data) {
  const sanitized = { ...data };
  if (sanitized.name) sanitized.name = escapeHtml(sanitizeInput(sanitized.name, { maxLength: 100 }));
  if (sanitized.specification) sanitized.specification = escapeHtml(sanitizeInput(sanitized.specification, { maxLength: 100 }));
  if (sanitized.frequency) sanitized.frequency = escapeHtml(sanitizeInput(sanitized.frequency, { maxLength: 50 }));
  if (sanitized.notes) sanitized.notes = escapeHtml(sanitizeInput(sanitized.notes, { maxLength: 500 }));
  return sanitized;
}

// 获取指定成员的所有用药记录
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

    return await Medication.findAll({
      where: { memberId },
      order: [['createdAt', 'DESC']]
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('获取用药记录失败:', error);
    throw new HttpError(500, '获取用药记录失败', error.message);
  }
}

// 获取单个用药记录
async function getById(userId, id) {
  try {
    const medication = await Medication.findOne({
      where: { id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId }
      }]
    });

    if (!medication) {
      throw new HttpError(404, '用药记录不存在或无权限访问');
    }

    return medication;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('获取用药记录详情失败:', error);
    throw new HttpError(500, '获取用药记录详情失败', error.message);
  }
}

// 创建用药记录
async function create(userId, body) {
  try {
    const sanitized = sanitizeMedicationData(body);
    const { memberId, name, specification, frequency, notes } = sanitized;

    // 验证必填字段
    if (!memberId || !name) {
      throw new HttpError(400, '家庭成员和药品名称为必填字段');
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

    const medication = await Medication.create({
      memberId,
      name,
      specification: specification || null,
      frequency: frequency || null,
      notes: notes || null,
      isActive: true
    });

    // 自动创建医疗日志
    await MedicalLog.create({
      memberId,
      logType: 'medication',
      title: `开始用药: ${name}`,
      description: `规格: ${specification || '未知'}, 服用频率: ${frequency || '未指定'}${notes ? ', 备注: ' + notes : ''}`,
      relatedMedicationId: medication.id,
      logDate: new Date().toISOString().split('T')[0],
      treatmentStartDate: new Date() // 调整发生的时间
    });

    return medication;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('创建用药记录失败:', error);
    throw new HttpError(500, '创建用药记录失败', error.message);
  }
}

// 更新用药记录
async function update(userId, id, body) {
  try {
    const sanitized = sanitizeMedicationData(body);
    const { name, specification, frequency, notes, isActive } = sanitized;

    const medication = await Medication.findOne({
      where: { id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId }
      }]
    });

    if (!medication) {
      throw new HttpError(404, '用药记录不存在或无权限访问');
    }

    const previousIsActive = medication.isActive;

    await medication.update({
      name: name || medication.name,
      specification: specification !== undefined ? specification : medication.specification,
      frequency: frequency !== undefined ? frequency : medication.frequency,
      notes: notes !== undefined ? notes : medication.notes,
      isActive: isActive !== undefined ? isActive : medication.isActive
    });

    // 如果停用状态发生变化，记录日志
    if (previousIsActive !== medication.isActive) {
      await MedicalLog.create({
        memberId: medication.memberId,
        logType: 'medication',
        title: medication.isActive ? `恢复用药: ${medication.name}` : `停止用药: ${medication.name}`,
        description: medication.notes || '',
        relatedMedicationId: medication.id,
        logDate: new Date().toISOString().split('T')[0],
        treatmentStartDate: new Date() // 调整发生的时间
      });
    }

    return medication;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('更新用药记录失败:', error);
    throw new HttpError(500, '更新用药记录失败', error.message);
  }
}

// 删除用药记录
async function remove(userId, id) {
  try {
    const medication = await Medication.findOne({
      where: { id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId }
      }]
    });

    if (!medication) {
      throw new HttpError(404, '用药记录不存在或无权限访问');
    }

    await medication.destroy();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('删除用药记录失败:', error);
    throw new HttpError(500, '删除用药记录失败', error.message);
  }
}

module.exports = { listByMember, getById, create, update, remove };
