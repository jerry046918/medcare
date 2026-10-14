const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/reportService');

exports.list = asyncHandler(async (req, res) => {
  const data = await reportService.listByUser(req.user.id);
  res.json({ success: true, data });
});
exports.getDetail = asyncHandler(async (req, res) => {
  const data = await reportService.getById(req.user.id, req.params.id);
  res.json({ success: true, data });
});
exports.create = asyncHandler(async (req, res) => {
  const data = await reportService.create(req.user.id, req.body, req.file);
  res.status(201).json({ success: true, message: '报告创建成功', data });
});
exports.update = asyncHandler(async (req, res) => {
  const data = await reportService.update(req.user.id, req.params.id, req.body, req.file);
  res.json({ success: true, message: '报告更新成功', data });
});
exports.remove = asyncHandler(async (req, res) => {
  await reportService.remove(req.user.id, req.params.id);
  res.json({ success: true, message: '报告删除成功' });
});
