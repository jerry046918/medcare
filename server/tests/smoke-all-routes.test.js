const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, auth, request } = require('./helpers/app');

test('auth: 登录成功与失败', async () => {
  const app = await getTestApp();
  await createAdmin();
  const ok = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'pass123456' });
  assert.strictEqual(ok.status, 200);
  const bad = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
  assert.strictEqual(bad.status, 401);
});

test('indicators/hospitals/config/ocr 基本可用', async () => {
  const app = await getTestApp();
  const { token } = await createAdmin();
  const ind = await auth(request(app).get('/api/indicators'), token);
  assert.strictEqual(ind.status, 200);
  const hos = await auth(request(app).get('/api/hospitals/provinces'), token);
  assert.strictEqual(hos.status, 200);
  const cfg = await auth(request(app).get('/api/config'), token);
  assert.strictEqual(cfg.status, 200);
  const engines = await auth(request(app).get('/api/ocr/engines'), token);
  assert.strictEqual(engines.status, 200);
});

test('medications/medicalLogs CRUD 最小路径', async () => {
  const app = await getTestApp();
  const { token } = await createAdmin();
  const member = await auth(request(app).post('/api/family-members'), token)
    .send({ name: '用药对象', gender: '男', relationship: '儿子' });
  const mid = member.body.data.id;
  // POST 字段以旧路由实现为准：medications 必填 memberId+name（无 dosage 字段）；
  // medical-logs 必填 memberId+logType(手动类型)+title，日期走 treatmentStartDate。
  const med = await auth(request(app).post('/api/medications'), token)
    .send({ memberId: mid, name: '维生素C', specification: '100mg/粒', frequency: '每日一次' });
  assert.strictEqual(med.status, 201);
  const log = await auth(request(app).post('/api/medical-logs'), token)
    .send({ memberId: mid, logType: 'outpatient', title: '普通感冒复诊', description: '门诊随访', treatmentStartDate: '2026-10-01' });
  assert.strictEqual(log.status, 201);
});
