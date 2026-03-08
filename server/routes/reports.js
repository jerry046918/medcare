const express = require('express');
const { MedicalReport, FamilyMember, ReportIndicatorData, MedicalIndicator, MedicalLog } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

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
      message: '获取报告列表失败',
      error: error.message
    });
  }
});

// 获取单个报告详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const report = await MedicalReport.findOne({
      where: { id: req.params.id },
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
      message: '获取报告详情失败',
      error: error.message
    });
  }
});

// 创建报告
router.post('/', authenticateToken, async (req, res) => {
  const { sequelize } = require('../models');
  let transaction = null;
  
  try {
    transaction = await sequelize.transaction();
    const { familyMemberId, reportDate, hospitalName, doctorName, notes, indicatorData } = req.body;

    console.log('[Reports API] 收到创建报告请求:', {
      familyMemberId,
      reportDate,
      hospitalName,
      indicatorCount: indicatorData?.length || 0
    });

    // 验证必填字段
    if (!familyMemberId || !reportDate) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '家庭成员和报告日期为必填字段'
      });
    }

    // 验证家庭成员是否属于当前用户
    const familyMember = await FamilyMember.findOne({
      where: { 
        id: familyMemberId,
        userId: req.user.id 
      },
      transaction
    });

    if (!familyMember) {
      if (transaction) await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '家庭成员不存在或无权限访问'
      });
    }

    // 创建报告
    const report = await MedicalReport.create({
      memberId: familyMemberId,
      reportDate,
      hospitalName: hospitalName || null,
      doctorName: doctorName || null,
      notes: notes || null
    }, { transaction });

    console.log('[Reports API] 报告创建成功, ID:', report.id);

    // 创建指标数据
    if (indicatorData && Array.isArray(indicatorData) && indicatorData.length > 0) {
      // 去重：每个 indicatorId 只保留第一条记录
      const seenIndicatorIds = new Set();
      const deduplicatedData = [];
      
      for (const item of indicatorData) {
        if (item.indicatorId && !seenIndicatorIds.has(item.indicatorId)) {
          seenIndicatorIds.add(item.indicatorId);
          deduplicatedData.push(item);
        } else if (item.indicatorId) {
          console.log('[Reports API] 跳过重复指标:', item.indicatorId, '值:', item.value);
        }
      }
      
      console.log('[Reports API] 原始指标数:', indicatorData.length, '去重后:', deduplicatedData.length);
      
      const indicatorDataToCreate = deduplicatedData.map(item => ({
        reportId: report.id,
        indicatorId: item.indicatorId,
        value: String(item.value), // 确保value是字符串
        referenceRange: item.referenceRange || null,
        isNormal: item.isNormal !== undefined ? item.isNormal : true,
        abnormalType: item.abnormalType || 'normal',
        notes: item.notes || null
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
      memberId: familyMemberId,
      logType: 'report',
      title: `新增检查报告 - ${hospitalName || '未知医院'}`,
      description: `在${hospitalName || '未知医院'}进行了检查，医生：${doctorName || '未知'}`,
      hospital: hospitalName || null,
      relatedReportId: report.id,
      logDate: reportDate,
      treatmentStartDate: reportDate
    }, { transaction });
    
    // 提交事务
    await transaction.commit();
    console.log('[Reports API] 事务提交成功');
    
    res.status(201).json({
      success: true,
      message: '报告创建成功',
      data: fullReportData
    });
  } catch (error) {
    // 回滚事务
    if (transaction) {
      try {
        await transaction.rollback();
        console.log('[Reports API] 事务已回滚');
      } catch (rollbackError) {
        console.error('[Reports API] 事务回滚失败:', rollbackError);
      }
    }
    console.error('[Reports API] 创建报告失败:', error);
    console.error('[Reports API] 错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: '创建报告失败: ' + error.message,
      error: error.message
    });
  }
});

// 更新报告
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { reportDate, hospitalName, doctorName, notes, indicatorData } = req.body;

    const report = await MedicalReport.findOne({
      where: { id: req.params.id },
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

    await report.update({
      reportDate: reportDate || report.reportDate,
      hospitalName: hospitalName !== undefined ? hospitalName : report.hospitalName,
      doctorName: doctorName !== undefined ? doctorName : report.doctorName,
      notes: notes !== undefined ? notes : report.notes
    });

    // 更新指标数据
    console.log('接收到的指标数据:', indicatorData);
    if (indicatorData && Array.isArray(indicatorData)) {
      console.log('指标数据是数组，长度:', indicatorData.length);
      // 删除现有的指标数据
      const deletedCount = await ReportIndicatorData.destroy({
        where: { reportId: req.params.id }
      });
      console.log('删除了', deletedCount, '条现有指标数据');

      // 创建新的指标数据
      if (indicatorData.length > 0) {
        const indicatorDataToCreate = indicatorData.map(item => ({
          reportId: req.params.id,
          indicatorId: item.indicatorId,
          value: item.value,
          referenceRange: item.referenceRange || null,
          isNormal: item.isNormal !== undefined ? item.isNormal : true,
          abnormalType: item.abnormalType || 'normal',
          notes: item.notes || null
        }));

        console.log('准备创建的指标数据:', indicatorDataToCreate);
        const createdIndicators = await ReportIndicatorData.bulkCreate(indicatorDataToCreate);
        console.log('成功创建了', createdIndicators.length, '条指标数据');
      }
    } else {
      console.log('没有接收到有效的指标数据');
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
      ]
    });

    // 添加 familyMemberId 字段以兼容前端
    const updatedReportData = updatedReport.toJSON();
    updatedReportData.familyMemberId = updatedReportData.memberId;

    res.json({
      success: true,
      message: '报告更新成功',
      data: updatedReportData
    });
  } catch (error) {
    console.error('更新报告失败:', error);
    res.status(500).json({
      success: false,
      message: '更新报告失败',
      error: error.message
    });
  }
});

// 删除报告
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const report = await MedicalReport.findOne({
      where: { id: req.params.id },
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
      where: { reportId: req.params.id }
    });

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
      message: '删除报告失败',
      error: error.message
    });
  }
});

module.exports = router;