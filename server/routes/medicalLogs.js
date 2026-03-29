const express = require('express');
const { MedicalLog, FamilyMember, MedicalReport, Medication } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, escapeHtml } = require('../utils/security');
const router = express.Router();

function sanitizeLogData(data) {
  const sanitized = { ...data };
  if (sanitized.title) sanitized.title = escapeHtml(sanitizeInput(sanitized.title, { maxLength: 200 }));
  if (sanitized.description) sanitized.description = escapeHtml(sanitizeInput(sanitized.description, { maxLength: 2000 }));
  if (sanitized.hospital) sanitized.hospital = escapeHtml(sanitizeInput(sanitized.hospital, { maxLength: 200 }));
  return sanitized;
}

// 获取指定成员的所有医疗日志
router.get('/member/:memberId', authenticateToken, async (req, res) => {
  try {
    // 验证家庭成员属于当前用户
    const familyMember = await FamilyMember.findOne({
      where: { 
        id: req.params.memberId,
        userId: req.user.id 
      }
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        message: '家庭成员不存在或无权限访问'
      });
    }

    const logs = await MedicalLog.findAll({
      where: { memberId: req.params.memberId },
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

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取医疗日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取医疗日志失败',
      error: error.message
    });
  }
});

// 获取单个医疗日志
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const log = await MedicalLog.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: FamilyMember,
          as: 'familyMember',
          where: { userId: req.user.id }
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
      return res.status(404).json({
        success: false,
        message: '医疗日志不存在或无权限访问'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('获取医疗日志详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取医疗日志详情失败',
      error: error.message
    });
  }
});

// 创建手动医疗日志
router.post('/', authenticateToken, async (req, res) => {
  try {
    const sanitized = sanitizeLogData(req.body);
    const { memberId, logType, title, description, hospital, treatmentStartDate, treatmentEndDate } = sanitized;

    // 验证必填字段
    if (!memberId || !logType || !title) {
      return res.status(400).json({
        success: false,
        message: '家庭成员、行为类型和标题为必填字段'
      });
    }

    // 验证logType必须是手动类型
    const manualTypes = ['hospitalization', 'outpatient', 'emergency'];
    if (!manualTypes.includes(logType)) {
      return res.status(400).json({
        success: false,
        message: '手动日志类型必须是：住院治疗、门诊治疗或急诊治疗'
      });
    }

    // 验证家庭成员是否属于当前用户
    const familyMember = await FamilyMember.findOne({
      where: { 
        id: memberId,
        userId: req.user.id 
      }
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        message: '家庭成员不存在或无权限访问'
      });
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
    const fullLog = await MedicalLog.findOne({
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

    res.status(201).json({
      success: true,
      message: '医疗日志创建成功',
      data: fullLog
    });
  } catch (error) {
    console.error('创建医疗日志失败:', error);
    res.status(500).json({
      success: false,
      message: '创建医疗日志失败',
      error: error.message
    });
  }
});

// 更新医疗日志
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const sanitized = sanitizeLogData(req.body);
    const { title, description, hospital, treatmentStartDate, treatmentEndDate } = sanitized;

    const log = await MedicalLog.findOne({
      where: { id: req.params.id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId: req.user.id }
      }]
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: '医疗日志不存在或无权限访问'
      });
    }

    // 只允许编辑手动添加的日志
    const manualTypes = ['hospitalization', 'outpatient', 'emergency'];
    if (!manualTypes.includes(log.logType)) {
      return res.status(400).json({
        success: false,
        message: '系统自动生成的日志不能编辑'
      });
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

    res.json({
      success: true,
      message: '医疗日志更新成功',
      data: log
    });
  } catch (error) {
    console.error('更新医疗日志失败:', error);
    res.status(500).json({
      success: false,
      message: '更新医疗日志失败',
      error: error.message
    });
  }
});

// 删除医疗日志
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const log = await MedicalLog.findOne({
      where: { id: req.params.id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId: req.user.id }
      }]
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: '医疗日志不存在或无权限访问'
      });
    }

    // 只允许删除手动添加的日志
    const manualTypes = ['hospitalization', 'outpatient', 'emergency'];
    if (!manualTypes.includes(log.logType)) {
      return res.status(400).json({
        success: false,
        message: '系统自动生成的日志不能删除'
      });
    }

    await log.destroy();

    res.json({
      success: true,
      message: '医疗日志删除成功'
    });
  } catch (error) {
    console.error('删除医疗日志失败:', error);
    res.status(500).json({
      success: false,
      message: '删除医疗日志失败',
      error: error.message
    });
  }
});

module.exports = router;
