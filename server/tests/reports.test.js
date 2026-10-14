const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { getTestApp, createAdmin, auth, request } = require('./helpers/app');

// 旧实现的 multer diskStorage 不会自动创建目录，上传前必须保证目录存在（与生产行为一致）
const uploadDir = path.join(__dirname, '..', 'uploads', 'reports');
fs.mkdirSync(uploadDir, { recursive: true });
test.after(() => {
  for (const f of fs.readdirSync(uploadDir)) {
    fs.unlinkSync(path.join(uploadDir, f));
  }
});

async function setup() {
  const app = await getTestApp();
  const { token } = await createAdmin();
  const member = await auth(request(app).post('/api/members'), token)
    .send({ name: '报告对象', gender: '女', relationship: '配偶' });
  assert.strictEqual(member.status, 201);
  return { app, token, memberId: member.body.data.id };
}

async function createIndicator(app, token, name) {
  const res = await auth(request(app).post('/api/indicators'), token)
    .send({ name, type: '血液', valueType: 'numeric', unit: '10^9/L', normalMin: 4, normalMax: 10 });
  assert.strictEqual(res.status, 201);
  return res.body.data.id;
}

// 1x1 红色 PNG
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('报告全流程：创建（附件+指标）→列表→详情→更新→删除', async () => {
  const { app, token, memberId } = await setup();
  const indicatorId = await createIndicator(app, token, '白细胞');

  const create = await auth(request(app).post('/api/reports'), token)
    .field('familyMemberId', String(memberId))
    .field('reportDate', '2026-10-01')
    .field('hospitalName', '测试医院')
    .field('doctorName', '张医生')
    .field('notes', '常规体检')
    .field('indicatorData', JSON.stringify([{
      indicatorId,
      value: '5.0',
      referenceRange: '4-10',
      isNormal: false,
      abnormalType: 'high',
      notes: '手动录入'
    }]))
    .attach('file', png, { filename: 'r.png', contentType: 'image/png' });
  assert.strictEqual(create.status, 201);
  assert.strictEqual(create.body.success, true);
  assert.strictEqual(create.body.message, '报告创建成功');
  const id = create.body.data.id;
  assert.strictEqual(create.body.data.familyMemberId, memberId);
  assert.strictEqual(create.body.data.hospitalName, '测试医院');
  assert.strictEqual(create.body.data.fileName, 'r.png');
  assert.ok(create.body.data.filePath.startsWith('uploads/reports/'));
  assert.strictEqual(create.body.data.indicatorData.length, 1);
  assert.strictEqual(create.body.data.indicatorData[0].value, '5.0');
  assert.strictEqual(create.body.data.indicatorData[0].indicator.id, indicatorId);

  const list = await auth(request(app).get('/api/reports'), token);
  assert.strictEqual(list.status, 200);
  assert.ok(Array.isArray(list.body.data));
  const mine = list.body.data.find(r => r.id === id);
  assert.ok(mine, '列表应包含刚创建的报告');
  assert.strictEqual(mine.familyMemberId, memberId, '列表需带 familyMemberId 兼容字段');
  assert.strictEqual(mine.indicatorCount, 1, '列表需带 indicatorCount 兼容字段');
  assert.ok(!('indicatorData' in mine), '列表不应携带 indicatorData 明细');

  const detail = await auth(request(app).get(`/api/reports/${id}`), token);
  assert.strictEqual(detail.status, 200);
  assert.strictEqual(detail.body.data.familyMemberId, memberId);
  assert.strictEqual(detail.body.data.indicatorData.length, 1);
  assert.strictEqual(detail.body.data.indicatorData[0].indicator.name, '白细胞');

  const update = await auth(request(app).put(`/api/reports/${id}`), token)
    .field('reportDate', '2026-10-02')
    .field('hospitalName', '更新医院')
    .field('indicatorData', JSON.stringify([{ indicatorId, value: '6.5', abnormalType: 'normal' }]));
  assert.strictEqual(update.status, 200);
  assert.strictEqual(update.body.message, '报告更新成功');
  assert.strictEqual(update.body.data.hospitalName, '更新医院');
  assert.strictEqual(update.body.data.reportDate, '2026-10-02');
  assert.strictEqual(update.body.data.indicatorData.length, 1);
  assert.strictEqual(update.body.data.indicatorData[0].value, '6.5');
  assert.strictEqual(update.body.data.filePath, create.body.data.filePath, '未上传新文件时应保留原文件');

  const del = await auth(request(app).delete(`/api/reports/${id}`), token);
  assert.strictEqual(del.status, 200);
  assert.strictEqual(del.body.message, '报告删除成功');
  assert.ok(!fs.existsSync(path.join(uploadDir, path.basename(create.body.data.filePath))),
    '删除报告时应同时删除已上传文件');

  const gone = await auth(request(app).get(`/api/reports/${id}`), token);
  assert.strictEqual(gone.status, 404);
  assert.strictEqual(gone.body.message, '报告不存在');
  const listAfter = await auth(request(app).get('/api/reports'), token);
  assert.ok(!listAfter.body.data.some(r => r.id === id));
});

test('缺少家庭成员返回 400', async () => {
  const { app, token } = await setup();
  const res = await auth(request(app).post('/api/reports'), token)
    .field('reportDate', '2026-10-01');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.message, '无效的家庭成员ID');
});

test('无效日期返回 400', async () => {
  const { app, token, memberId } = await setup();
  const res = await auth(request(app).post('/api/reports'), token)
    .field('familyMemberId', String(memberId))
    .field('reportDate', 'not-a-date');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.message, '无效的报告日期');
});

test('不属于当前用户的成员返回 404', async () => {
  const { app, token } = await setup();
  const res = await auth(request(app).post('/api/reports'), token)
    .field('familyMemberId', '999999')
    .field('reportDate', '2026-10-01');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.message, '家庭成员不存在或无权限访问');
});

test('无附件创建：filePath 为空，空 indicatorId 的指标被跳过', async () => {
  const { app, token, memberId } = await setup();
  const create = await auth(request(app).post('/api/reports'), token)
    .field('familyMemberId', String(memberId))
    .field('reportDate', '2026-10-01')
    .field('hospitalName', '无附件医院')
    .field('indicatorData', JSON.stringify([{ indicatorId: null, value: '5.0', notes: '手动' }]));
  assert.strictEqual(create.status, 201);
  assert.strictEqual(create.body.data.filePath, null);
  assert.strictEqual(create.body.data.fileName, null);
  assert.strictEqual(create.body.data.indicatorData.length, 0);

  const list = await auth(request(app).get('/api/reports'), token);
  const mine = list.body.data.find(r => r.id === create.body.data.id);
  assert.strictEqual(mine.indicatorCount, 0);
});

test('不支持的文件类型被拒绝', async () => {
  const { app, token, memberId } = await setup();
  const res = await auth(request(app).post('/api/reports'), token)
    .field('familyMemberId', String(memberId))
    .field('reportDate', '2026-10-01')
    .attach('file', Buffer.from('hello'), { filename: 'r.txt', contentType: 'text/plain' });
  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.message, '不支持的文件类型');

  const list = await auth(request(app).get('/api/reports'), token);
  assert.ok(!list.body.data.some(r => r.familyMemberId === memberId));
});

test('更新时上传新文件会替换旧文件', async () => {
  const { app, token, memberId } = await setup();
  const create = await auth(request(app).post('/api/reports'), token)
    .field('familyMemberId', String(memberId))
    .field('reportDate', '2026-10-01')
    .attach('file', png, { filename: 'r.png', contentType: 'image/png' });
  assert.strictEqual(create.status, 201);
  const id = create.body.data.id;
  const oldPath = path.join(uploadDir, path.basename(create.body.data.filePath));

  const update = await auth(request(app).put(`/api/reports/${id}`), token)
    .field('hospitalName', '换文件医院')
    .attach('file', png, { filename: 'r2.png', contentType: 'image/png' });
  assert.strictEqual(update.status, 200);
  assert.strictEqual(update.body.data.fileName, 'r2.png');
  assert.notStrictEqual(update.body.data.filePath, create.body.data.filePath);
  assert.ok(!fs.existsSync(oldPath), '旧文件应被删除');
  assert.ok(fs.existsSync(path.join(uploadDir, path.basename(update.body.data.filePath))),
    '新文件应已落盘');
});

test('不存在的/非法的报告 ID', async () => {
  const { app, token } = await setup();

  const badGet = await auth(request(app).get('/api/reports/abc'), token);
  assert.strictEqual(badGet.status, 400);
  assert.strictEqual(badGet.body.message, '无效的报告ID');

  const missingGet = await auth(request(app).get('/api/reports/999999'), token);
  assert.strictEqual(missingGet.status, 404);
  assert.strictEqual(missingGet.body.message, '报告不存在');

  const missingPut = await auth(request(app).put('/api/reports/999999'), token)
    .field('reportDate', '2026-10-01');
  assert.strictEqual(missingPut.status, 404);
  assert.strictEqual(missingPut.body.message, '报告不存在或无权限访问');

  const missingDel = await auth(request(app).delete('/api/reports/999999'), token);
  assert.strictEqual(missingDel.status, 404);
  assert.strictEqual(missingDel.body.message, '报告不存在或无权限访问');
});

test('未认证访问被拒', async () => {
  const { app } = await setup();
  const res = await request(app).get('/api/reports');
  assert.strictEqual(res.status, 401);
});
