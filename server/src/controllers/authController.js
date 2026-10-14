const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

exports.register = asyncHandler(async (req, res) => {
  const { status, body } = await authService.register(req.body);
  res.status(status).json(body);
});

exports.login = asyncHandler(async (req, res) => {
  const { status, body } = await authService.login(req.body);
  res.status(status).json(body);
});

exports.verify = asyncHandler(async (req, res) => {
  const { status, body } = await authService.verify(req.headers.authorization);
  res.status(status).json(body);
});

exports.initStatus = asyncHandler(async (req, res) => {
  const { status, body } = await authService.initStatus();
  res.status(status).json(body);
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { status, body } = await authService.changePassword(req.user.id, req.body);
  res.status(status).json(body);
});
