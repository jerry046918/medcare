const asyncHandler = require('../utils/asyncHandler');
const configService = require('../services/configService');

exports.list = asyncHandler(async (req, res) => {
  const data = await configService.getPublicConfigs();
  res.json({ success: true, data });
});

exports.getByCategory = asyncHandler(async (req, res) => {
  const data = await configService.getByCategory(req.params.category);
  res.json({ success: true, data });
});

exports.update = asyncHandler(async (req, res) => {
  const data = await configService.updateByKey(req.params.key, req.body);
  res.json({ success: true, message: '配置更新成功', data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await configService.create(req.body);
  res.status(201).json({ success: true, message: '配置创建成功', data });
});

exports.remove = asyncHandler(async (req, res) => {
  await configService.remove(req.params.key);
  res.json({ success: true, message: '配置删除成功' });
});

exports.saveOcrBatch = asyncHandler(async (req, res) => {
  await configService.saveOcrBatch(req.body);
  res.json({ success: true, message: 'OCR 配置保存成功' });
});

exports.getOcrFull = asyncHandler(async (req, res) => {
  const data = await configService.getOcrFull();
  res.json({ success: true, data });
});
