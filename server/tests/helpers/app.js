process.env.NODE_ENV = 'test';
process.env.MEDCARE_DB_PATH = ':memory:';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// pdfjs-dist（经 src/services/ocrService 间接加载）在 Node 缺少 DOM API 时会打印
// "Cannot polyfill DOMMatrix/Path2D" 警告；预先放置惰性占位类保持测试输出干净。
// 仅影响 canvas 渲染路径，测试用到的 PDF 文本提取不依赖这两个类。
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};

const request = require('supertest');
const { createApp } = require('../../src/app');
const { sequelize } = require('../../src/models');

let appPromise = null;
function getTestApp() {
  if (!appPromise) {
    appPromise = sequelize.sync({ force: true }).then(() => createApp());
  }
  return appPromise;
}
// 注册首个管理员（旧版注册协议：username/password；Task 10 后更新为新协议）
async function createAdmin() {
  const app = await getTestApp();
  const res = await request(app).post('/api/auth/register')
    .send({ username: 'admin', password: 'pass123456' });
  if (res.status !== 201) throw new Error(`createAdmin 失败: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.token, userId: res.body.data.user.id };
}
function auth(agent, token) {
  return agent.set('Authorization', `Bearer ${token}`);
}
module.exports = { getTestApp, createAdmin, auth, request };
