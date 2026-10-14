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
// 注册首个管理员（v2 注册协议：mode=create + memberData 自带本人成员，免邀请码）。
// 测试文件的多个用例都会调用本函数，重复注册同名账户会 400，故按用户名缓存成功结果；
// 失败不缓存，下次调用会重试。
const adminCache = new Map();
async function createAdmin(username = 'admin') {
  if (!adminCache.has(username)) {
    adminCache.set(username, (async () => {
      const app = await getTestApp();
      const res = await request(app).post('/api/auth/register').send({
        username, password: 'pass123456', mode: 'create',
        memberData: { name: `${username}本人`, gender: '男' }
      });
      if (res.status !== 201) {
        adminCache.delete(username);
        throw new Error(`createAdmin 失败: ${res.status} ${JSON.stringify(res.body)}`);
      }
      return { token: res.body.data.token, userId: res.body.data.user.id };
    })());
  }
  return adminCache.get(username);
}
// 注册普通成员账户（需邀请码）；返回原始响应（含失败状态）
async function createUser(username, { inviteCode, mode = 'create', memberData = null, claimMemberId = null } = {}) {
  const app = await getTestApp();
  const res = await request(app).post('/api/auth/register').send({
    username, password: 'pass123456', inviteCode, mode, memberData, claimMemberId
  });
  return res;
}
function auth(agent, token) {
  return agent.set('Authorization', `Bearer ${token}`);
}
module.exports = { getTestApp, createAdmin, createUser, auth, request };
