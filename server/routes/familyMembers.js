const express = require('express');
const { FamilyMember, MedicalReport, ReportIndicatorData, MedicalIndicator } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

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
      message: '获取家庭成员失败',
      error: error.message
    });
  }
});

// 获取单个家庭成员详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const familyMember = await FamilyMember.findOne({
      where: { 
        id: req.params.id,
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
      message: '获取家庭成员详情失败',
      error: error.message
    });
  }
});

// 创建家庭成员
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, gender, relationship, birthday, weight, height } = req.body;

    // 验证必填字段
    if (!name || !gender || !relationship) {
      return res.status(400).json({
        success: false,
        message: '姓名、性别和关系为必填字段'
      });
    }

    const familyMember = await FamilyMember.create({
      name,
      gender,
      relationship,
      birthday: birthday || null,
      weight: weight || null,
      height: height || null,
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
      message: '创建家庭成员失败',
      error: error.message
    });
  }
});

// 更新家庭成员
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, gender, relationship, birthday, weight, height } = req.body;

    const familyMember = await FamilyMember.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id 
      }
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        message: '家庭成员不存在'
      });
    }

    await familyMember.update({
      name: name || familyMember.name,
      gender: gender || familyMember.gender,
      relationship: relationship || familyMember.relationship,
      birthday: birthday !== undefined ? birthday : familyMember.birthday,
      weight: weight !== undefined ? weight : familyMember.weight,
      height: height !== undefined ? height : familyMember.height
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
      message: '更新家庭成员失败',
      error: error.message
    });
  }
});

// 删除家庭成员
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const familyMember = await FamilyMember.findOne({
      where: { 
        id: req.params.id,
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
      where: { memberId: req.params.id }
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
      message: '删除家庭成员失败',
      error: error.message
    });
  }
});

module.exports = router;