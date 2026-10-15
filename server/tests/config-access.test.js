require('./helpers/app');
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');
const { SystemConfig } = require('../src/models');

// Final Finding 3：配置写入（PUT/POST/DELETE）与 OCR 批量/完整配置 admin 专属；
// 非管理员读 ocr 分类时 apiKey 脱敏，管理员读原文。

async function makeUser(app, admin, username) {
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser(username, { inviteCode: inv.code, memberData: { name: `${username}本人`, gender: '男' } });
  return reg.body.data;
}

test('config：非管理员 PUT/POST/DELETE/ocr批量/ocr完整 均 403，管理员放行', async () => {
  const app = await getTestApp();
  const admin = await createAdmin('cfgadmin');
  const u = await makeUser(app, admin, 'cfgUser');

  // admin 先建一个配置项作为写操作靶子
  const created = await auth(request(app).post('/api/config'), admin.token)
    .send({ key: 'cfg_access_probe', value: 'v1', type: 'string', category: 'test', description: '探针' });
  assert.strictEqual(created.status, 201);

  const put = await auth(request(app).put('/api/config/cfg_access_probe'), u.token)
    .send({ value: 'hacked' });
  assert.strictEqual(put.status, 403);

  const post = await auth(request(app).post('/api/config'), u.token)
    .send({ key: 'cfg_nope', value: 'x', category: 'test' });
  assert.strictEqual(post.status, 403);

  const del = await auth(request(app).delete('/api/config/cfg_access_probe'), u.token);
  assert.strictEqual(del.status, 403);

  const batch = await auth(request(app).post('/api/config/ocr/batch'), u.token)
    .send({ defaultEngine: 'paddleocr' });
  assert.strictEqual(batch.status, 403);

  const full = await auth(request(app).get('/api/config/ocr/full'), u.token);
  assert.strictEqual(full.status, 403);

  // 管理员同样操作放行
  const putAdmin = await auth(request(app).put('/api/config/cfg_access_probe'), admin.token)
    .send({ value: 'v2' });
  assert.strictEqual(putAdmin.status, 200);
  const fullAdmin = await auth(request(app).get('/api/config/ocr/full'), admin.token);
  assert.strictEqual(fullAdmin.status, 200);
  const delAdmin = await auth(request(app).delete('/api/config/cfg_access_probe'), admin.token);
  assert.strictEqual(delAdmin.status, 200);
});

test('config：GET /api/config/ocr 非管理员 apiKey 脱敏，管理员原文', async () => {
  const app = await getTestApp();
  const admin = await createAdmin('cfgadmin');
  const u = await makeUser(app, admin, 'cfgReader');

  const rawKey = 'sk-sensitive-abcdef123456';
  await SystemConfig.upsert({
    configKey: 'ocr_openai_vision',
    configValue: JSON.stringify({ enabled: true, apiKey: rawKey, baseURL: 'https://api.test', model: 'vision' }),
    configType: 'json',
    category: 'ocr',
    description: 'OpenAI Vision 配置',
    isPublic: false
  });

  const masked = await auth(request(app).get('/api/config/ocr'), u.token);
  assert.strictEqual(masked.status, 200);
  const maskedValue = masked.body.data.ocr_openai_vision.value;
  assert.strictEqual(maskedValue.apiKey, '****3456', '非管理员只能看到脱敏 key');
  assert.ok(!JSON.stringify(masked.body.data).includes(rawKey), '响应不得含原始 key');
  // 非秘密字段保留
  assert.strictEqual(maskedValue.baseURL, 'https://api.test');

  const full = await auth(request(app).get('/api/config/ocr'), admin.token);
  assert.strictEqual(full.status, 200);
  assert.strictEqual(full.body.data.ocr_openai_vision.value.apiKey, rawKey, '管理员读原文');
});
