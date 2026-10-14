const asyncHandler = require('../utils/asyncHandler');
const medicationService = require('../services/medicationService');

exports.listByMember = asyncHandler(async (req, res) => {
  const data = await medicationService.listByMember(req.user.id, req.params.memberId);
  res.json({ success: true, data });
});

exports.getDetail = asyncHandler(async (req, res) => {
  const data = await medicationService.getById(req.user.id, req.params.id);
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await medicationService.create(req.user.id, req.body);
  res.status(201).json({ success: true, message: '用药记录创建成功', data });
});

exports.update = asyncHandler(async (req, res) => {
  const data = await medicationService.update(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: '用药记录更新成功', data });
});

exports.remove = asyncHandler(async (req, res) => {
  await medicationService.remove(req.user.id, req.params.id);
  res.json({ success: true, message: '用药记录删除成功' });
});
