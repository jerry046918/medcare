const asyncHandler = require('../utils/asyncHandler');
const medicalLogService = require('../services/medicalLogService');

exports.listByMember = asyncHandler(async (req, res) => {
  const data = await medicalLogService.listByMember(req.user.id, req.params.memberId);
  res.json({ success: true, data });
});

exports.getDetail = asyncHandler(async (req, res) => {
  const data = await medicalLogService.getById(req.user.id, req.params.id);
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await medicalLogService.create(req.user.id, req.body);
  res.status(201).json({ success: true, message: '医疗日志创建成功', data });
});

exports.update = asyncHandler(async (req, res) => {
  const data = await medicalLogService.update(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: '医疗日志更新成功', data });
});

exports.remove = asyncHandler(async (req, res) => {
  await medicalLogService.remove(req.user.id, req.params.id);
  res.json({ success: true, message: '医疗日志删除成功' });
});
