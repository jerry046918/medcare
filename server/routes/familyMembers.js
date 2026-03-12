const express = require('express');
const { FamilyMember, MedicalReport, ReportIndicatorData, MedicalIndicator } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, escapeHtml, validateId, validateDate } = require('../utils/security');
const router = express.Router();

/**
 * 消毒家庭成员数据
 */
function sanitizeMemberData(data) {
  const sanitized = { ...data };

  if (sanitized.name) {
    sanitized.name = escapeHtml(sanitizeInput(sanitized.name, { maxLength: 50 }));
  }
  if (sanitized.relationship) {
    sanitized.relationship = escapeHtml(sanitizeInput(sanitized.relationship, { maxLength: 20 }));
  }

  return sanitized;
}

// 获取所有家庭成员
router.get('/', authenticateToken, async (req, res) => {
  try {
    const familyMembers = await FamilyMember.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      include: [{
        model: MedicalReport,
        as: 'reports',
        attributes: ['id', 'reportDate', 'hospitalName']
      }]
    });

    // 添加计算字段
    const membersWithCalculatedFields = familyMembers.map(member => {
      const memberData = member.toJSON();
      memberData.age = member.getAge();
      memberData.bmi = member.getBMI();
      memberData.reportCount = memberData.reports ? memberData.reports.length : 0;
      return memberData;
    });

    res.json({
      success: true,
      data: membersWithCalculatedFields
    });
  } catch (error) {
    console.error('获取家庭成员失败:', error);
    res.status(500).json({
      success: false,
      message: '获取家庭成员失败'
    });
  }
});

// 获取单个家庭成员详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // 验证 ID
    const memberId = validateId(req.params.id);
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: '无效的成员ID'
      });
    }

    const familyMember = await FamilyMember.findOne({
      where: {
        id: memberId,
        userId: req.user.id
      },
      include: [{
        model: MedicalReport,
        as: 'reports',
        order: [['reportDate', 'DESC']],
        include: [{
          model: ReportIndicatorData,
          as: 'indicatorData',
          include: [{
            model: MedicalIndicator,
            as: 'indicator'
          }]
        }]
      }]
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        message: '家庭成员不存在'
      });
    }

    const memberData = familyMember.toJSON();
    memberData.age = familyMember.getAge();
    memberData.bmi = familyMember.getBMI();

    res.json({
      success: true,
      data: memberData
    });
  } catch (error) {
    console.error('获取家庭成员详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取家庭成员详情失败'
    });
  }
});

// 创建家庭成员
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, gender, relationship, birthday, weight, height } = req.body;

    // 消毒输入
    const sanitizedData = sanitizeMemberData({ name, relationship });

    // 验证必填字段
    if (!sanitizedData.name || !gender || !sanitizedData.relationship) {
      return res.status(400).json({
        success: false,
        message: '姓名、性别和关系为必填字段'
      });
    }

    // 验证性别
    const validGenders = ['男', '女', '其他'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: '无效的性别值'
      });
    }

    // 验证生日（如果提供）
    if (birthday && !validateDate(birthday)) {
      return res.status(400).json({
        success: false,
        message: '无效的生日日期'
      });
    }

    // 验证体重和身高（如果提供）
    const validatedWeight = weight !== undefined ? parseFloat(weight) : null;
    const validatedHeight = height !== undefined ? parseFloat(height) : null;

    if (validatedWeight !== null && (isNaN(validatedWeight) || validatedWeight <= 0 || validatedWeight > 500)) {
      return res.status(400).json({
        success: false,
        message: '无效的体重值'
      });
    }

    if (validatedHeight !== null && (isNaN(validatedHeight) || validatedHeight <= 0 || validatedHeight > 300)) {
      return res.status(400).json({
        success: false,
        message: '无效的身高值'
      });
    }

    const familyMember = await FamilyMember.create({
      name: sanitizedData.name,
      gender,
      relationship: sanitizedData.relationship,
      birthday: birthday || null,
      weight: validatedWeight,
      height: validatedHeight,
      userId: req.user.id
    });

    const memberData = familyMember.toJSON();
    memberData.age = familyMember.getAge();
    memberData.bmi = familyMember.getBMI();

    res.status(201).json({
      success: true,
      message: '家庭成员创建成功',
      data: memberData
    });
  } catch (error) {
    console.error('创建家庭成员失败:', error);
    res.status(500).json({
      success: false,
      message: '创建家庭成员失败'
    });
  }
});

// 更新家庭成员
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // 验证 ID
    const memberId = validateId(req.params.id);
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: '无效的成员ID'
      });
    }

    const { name, gender, relationship, birthday, weight, height } = req.body;

    const familyMember = await FamilyMember.findOne({
      where: {
        id: memberId,
        userId: req.user.id
      }
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        message: '家庭成员不存在'
      });
    }

    // 消毒输入
    const sanitizedData = sanitizeMemberData({ name, relationship });

    // 验证性别（如果提供）
    if (gender) {
      const validGenders = ['男', '女', '其他'];
      if (!validGenders.includes(gender)) {
        return res.status(400).json({
          success: false,
          message: '无效的性别值'
        });
      }
    }

    // 验证生日（如果提供）
    if (birthday !== undefined && birthday !== null && !validateDate(birthday)) {
      return res.status(400).json({
        success: false,
        message: '无效的生日日期'
      });
    }

    // 验证体重和身高（如果提供）
    const validatedWeight = weight !== undefined ? parseFloat(weight) : familyMember.weight;
    const validatedHeight = height !== undefined ? parseFloat(height) : familyMember.height;

    if (validatedWeight !== null && (isNaN(validatedWeight) || validatedWeight <= 0 || validatedWeight > 500)) {
      return res.status(400).json({
        success: false,
        message: '无效的体重值'
      });
    }

    if (validatedHeight !== null && (isNaN(validatedHeight) || validatedHeight <= 0 || validatedHeight > 300)) {
      return res.status(400).json({
        success: false,
        message: '无效的身高值'
      });
    }

    await familyMember.update({
      name: sanitizedData.name || familyMember.name,
      gender: gender || familyMember.gender,
      relationship: sanitizedData.relationship || familyMember.relationship,
      birthday: birthday !== undefined ? birthday : familyMember.birthday,
      weight: validatedWeight,
      height: validatedHeight
    });

    const memberData = familyMember.toJSON();
    memberData.age = familyMember.getAge();
    memberData.bmi = familyMember.getBMI();

    res.json({
      success: true,
      message: '家庭成员更新成功',
      data: memberData
    });
  } catch (error) {
    console.error('更新家庭成员失败:', error);
    res.status(500).json({
      success: false,
      message: '更新家庭成员失败'
    });
  }
});

// 删除家庭成员
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // 验证 ID
    const memberId = validateId(req.params.id);
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: '无效的成员ID'
      });
    }

    const familyMember = await FamilyMember.findOne({
      where: {
        id: memberId,
        userId: req.user.id
      }
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        message: '家庭成员不存在'
      });
    }

    // 检查是否有关联的医疗报告
    const reportCount = await MedicalReport.count({
      where: { memberId: memberId }
    });

    if (reportCount > 0) {
      return res.status(400).json({
        success: false,
        message: `无法删除该家庭成员，因为存在 ${reportCount} 份关联的医疗报告`
      });
    }

    await familyMember.destroy();

    res.json({
      success: true,
      message: '家庭成员删除成功'
    });
  } catch (error) {
    console.error('删除家庭成员失败:', error);
    res.status(500).json({
      success: false,
      message: '删除家庭成员失败'
    });
  }
});

module.exports = router;
