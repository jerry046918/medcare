const express = require('express');
const { Medication, FamilyMember, MedicalLog } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// 获取指定成员的所有用药记录
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

    const medications = await Medication.findAll({
      where: { memberId: req.params.memberId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: medications
    });
  } catch (error) {
    console.error('获取用药记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用药记录失败',
      error: error.message
    });
  }
});

// 获取单个用药记录
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const medication = await Medication.findOne({
      where: { id: req.params.id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId: req.user.id }
      }]
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: '用药记录不存在或无权限访问'
      });
    }

    res.json({
      success: true,
      data: medication
    });
  } catch (error) {
    console.error('获取用药记录详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用药记录详情失败',
      error: error.message
    });
  }
});

// 创建用药记录
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { memberId, name, specification, frequency, notes } = req.body;

    // 验证必填字段
    if (!memberId || !name) {
      return res.status(400).json({
        success: false,
        message: '家庭成员和药品名称为必填字段'
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
    res.status(201).json({
      success: true,
      message: '用药记录创建成功',
      data: medication
    });
  } catch (error) {
    console.error('创建用药记录失败:', error);
    res.status(500).json({
      success: false,
      message: '创建用药记录失败',
      error: error.message
    });
  }
});

// 更新用药记录
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, specification, frequency, notes, isActive } = req.body;

    const medication = await Medication.findOne({
      where: { id: req.params.id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId: req.user.id }
      }]
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: '用药记录不存在或无权限访问'
      });
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
    res.json({
      success: true,
      message: '用药记录更新成功',
      data: medication
    });
  } catch (error) {
    console.error('更新用药记录失败:', error);
    res.status(500).json({
      success: false,
      message: '更新用药记录失败',
      error: error.message
    });
  }
});

// 删除用药记录
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const medication = await Medication.findOne({
      where: { id: req.params.id },
      include: [{
        model: FamilyMember,
        as: 'familyMember',
        where: { userId: req.user.id }
      }]
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: '用药记录不存在或无权限访问'
      });
    }

    await medication.destroy();

    res.json({
      success: true,
      message: '用药记录删除成功'
    });
  } catch (error) {
    console.error('删除用药记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除用药记录失败',
      error: error.message
    });
  }
});

module.exports = router;
