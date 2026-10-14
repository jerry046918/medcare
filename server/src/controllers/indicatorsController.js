const asyncHandler = require('../utils/asyncHandler');
const indicatorService = require('../services/indicatorService');

exports.list = asyncHandler(async (req, res) => {
  const data = await indicatorService.list();
  res.json({ success: true, data });
});

exports.getDetail = asyncHandler(async (req, res) => {
  const data = await indicatorService.getById(req.params.id);
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await indicatorService.create(req.body);
  res.status(201).json({ success: true, message: '指标创建成功', data });
});

exports.update = asyncHandler(async (req, res) => {
  const data = await indicatorService.update(req.params.id, req.body);
  res.json({ success: true, message: '指标更新成功', data });
});

exports.remove = asyncHandler(async (req, res) => {
  await indicatorService.remove(req.params.id);
  res.json({ success: true, message: '指标删除成功' });
});

exports.addAlias = asyncHandler(async (req, res) => {
  const result = await indicatorService.addAlias(req.params.id, req.body);
  if (result.noNewAliases) {
    return res.json({ success: true, message: '没有需要添加的新别名', data: result.indicator });
  }
  res.json({ success: true, message: `成功添加 ${result.addedCount} 个别名`, data: result.data });
});

exports.removeAlias = asyncHandler(async (req, res) => {
  const data = await indicatorService.removeAlias(req.params.id, req.body);
  res.json({ success: true, message: '别名删除成功', data });
});
