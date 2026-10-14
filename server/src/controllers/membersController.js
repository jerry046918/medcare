const asyncHandler = require('../utils/asyncHandler');
const memberService = require('../services/memberService');

exports.list = asyncHandler(async (req, res) => {
  const data = await memberService.listByUser(req.user.id);
  res.json({ success: true, data });
});
exports.getDetail = asyncHandler(async (req, res) => {
  const data = await memberService.getById(req.user.id, req.params.id);
  res.json({ success: true, data });
});
exports.create = asyncHandler(async (req, res) => {
  const data = await memberService.create(req.user.id, req.body);
  res.status(201).json({ success: true, message: '家庭成员创建成功', data });
});
exports.update = asyncHandler(async (req, res) => {
  const data = await memberService.update(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: '家庭成员更新成功', data });
});
exports.remove = asyncHandler(async (req, res) => {
  await memberService.remove(req.user.id, req.params.id);
  res.json({ success: true, message: '家庭成员删除成功' });
});
