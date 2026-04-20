#!/usr/bin/env node

/**
 * MedCare CLI — Agent-friendly command line interface
 * Output is JSON by default. Use --pretty for human-readable output.
 */

const { Command } = require('commander');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const CONFIG_DIR = path.join(require('os').homedir(), '.medcare');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// ── Config helpers ──────────────────────────────────────────────

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function getAxios() {
  const config = loadConfig();
  if (!config.token || !config.server) {
    console.error(JSON.stringify({ error: '未登录。请先运行 medcare login' }));
    process.exit(1);
  }
  return axios.create({
    baseURL: `${config.server}/api`,
    headers: { Authorization: `Bearer ${config.token}` },
    validateStatus: () => true,
  });
}

function output(data, pretty) {
  if (pretty) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}

function handleResponse(res, pretty) {
  if (res.status === 401) {
    output({ error: '认证失败，请重新登录' }, pretty);
    process.exit(1);
  }
  if (res.status >= 400) {
    output({ error: res.data?.message || `HTTP ${res.status}` }, pretty);
    process.exit(1);
  }
  output(res.data, pretty);
}

// ── Program ─────────────────────────────────────────────────────

const program = new Command();
program
  .name('medcare')
  .description('MedCare 家庭健康管理系统 CLI')
  .version('1.0.0')
  .option('--pretty', '格式化 JSON 输出（人类可读）');

// ── Login ───────────────────────────────────────────────────────

program
  .command('login')
  .description('登录并保存凭证')
  .requiredOption('-s, --server <url>', '服务器地址，如 http://localhost:3001')
  .requiredOption('-u, --username <user>', '用户名')
  .requiredOption('-p, --password <pass>', '密码')
  .action(async (opts) => {
    try {
      const res = await axios.post(`${opts.server}/api/auth/login`, {
        username: opts.username,
        password: opts.password,
      });
      if (!res.data.success) {
        output({ error: res.data.message || '登录失败' }, program.opts().pretty);
        process.exit(1);
      }
      saveConfig({ server: opts.server, token: res.data.data.token, username: opts.username });
      output({ success: true, message: '登录成功', server: opts.server }, program.opts().pretty);
    } catch (e) {
      output({ error: e.response?.data?.message || e.message }, program.opts().pretty);
      process.exit(1);
    }
  });

// ── Members ─────────────────────────────────────────────────────

const members = program.command('members').description('家庭成员管理');

members
  .command('list')
  .description('列出所有家庭成员')
  .action(async () => {
    const api = getAxios();
    const res = await api.get('/family-members');
    handleResponse(res, program.opts().pretty);
  });

members
  .command('get <id>')
  .description('获取家庭成员详情')
  .action(async (id) => {
    const api = getAxios();
    const res = await api.get(`/family-members/${id}`);
    handleResponse(res, program.opts().pretty);
  });

members
  .command('add')
  .description('添加家庭成员')
  .requiredOption('--name <name>', '姓名')
  .requiredOption('--gender <gender>', '性别（男/女）')
  .requiredOption('--relationship <rel>', '与用户关系')
  .option('--birthday <date>', '出生日期 (YYYY-MM-DD)')
  .option('--height <cm>', '身高(cm)')
  .option('--weight <kg>', '体重(kg)')
  .option('--phone <phone>', '手机号')
  .action(async (opts) => {
    const api = getAxios();
    const data = {
      name: opts.name,
      gender: opts.gender,
      relationship: opts.relationship,
    };
    if (opts.birthday) data.birthday = opts.birthday;
    if (opts.height) data.height = parseFloat(opts.height);
    if (opts.weight) data.weight = parseFloat(opts.weight);
    if (opts.phone) data.phone = opts.phone;
    const res = await api.post('/family-members', data);
    handleResponse(res, program.opts().pretty);
  });

// ── Reports ─────────────────────────────────────────────────────

const reports = program.command('reports').description('医疗报告管理');

reports
  .command('list')
  .description('列出报告')
  .option('--member <id>', '按家庭成员筛选')
  .option('--hospital <name>', '按医院筛选')
  .action(async (opts) => {
    const api = getAxios();
    const params = {};
    if (opts.member) params.familyMemberId = opts.member;
    if (opts.hospital) params.hospitalName = opts.hospital;
    const res = await api.get('/reports', { params });
    handleResponse(res, program.opts().pretty);
  });

reports
  .command('get <id>')
  .description('获取报告详情（含指标数据）')
  .action(async (id) => {
    const api = getAxios();
    const res = await api.get(`/reports/${id}`);
    handleResponse(res, program.opts().pretty);
  });

reports
  .command('upload')
  .description('上传报告文件并自动 OCR 识别')
  .requiredOption('--member <id>', '家庭成员 ID')
  .requiredOption('--file <path>', '报告文件路径（图片或 PDF）')
  .requiredOption('--date <date>', '报告日期 (YYYY-MM-DD)')
  .option('--hospital <name>', '医院名称')
  .option('--doctor <name>', '医生姓名')
  .option('--notes <text>', '备注')
  .action(async (opts) => {
    const api = getAxios();
    const filePath = path.resolve(opts.file);

    if (!fs.existsSync(filePath)) {
      output({ error: `文件不存在: ${filePath}` }, program.opts().pretty);
      process.exit(1);
    }

    // Step 1: OCR recognition
    let ocrData = [];
    try {
      const ocrForm = new FormData();
      ocrForm.append('image', fs.createReadStream(filePath));
      const ocrRes = await api.post('/ocr/recognize-and-parse', ocrForm, {
        headers: { ...ocrForm.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (ocrRes.data.success && ocrRes.data.data?.indicators) {
        ocrData = ocrRes.data.data.indicators
          .filter(ind => ind.indicatorId)
          .map(ind => ({
            indicatorId: ind.indicatorId,
            value: ind.value,
            referenceRange: ind.referenceRange || '',
            isNormal: ind.isNormal !== undefined ? ind.isNormal : true,
            abnormalType: ind.abnormalType || 'normal',
            notes: ind.notes || '',
          }));

        if (program.opts().pretty) {
          console.error(`OCR 识别到 ${ocrData.length} 个匹配指标`);
        }
      }
    } catch (e) {
      if (program.opts().pretty) {
        console.error(`OCR 识别失败（将创建空报告）: ${e.message}`);
      }
    }

    // Step 2: Create report with file
    const form = new FormData();
    form.append('familyMemberId', opts.member);
    form.append('reportDate', opts.date);
    if (opts.hospital) form.append('hospitalName', opts.hospital);
    if (opts.doctor) form.append('doctorName', opts.doctor);
    if (opts.notes) form.append('notes', opts.notes);
    form.append('indicatorData', JSON.stringify(ocrData));
    form.append('file', fs.createReadStream(filePath));

    const res = await api.post('/reports', form, {
      headers: { ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    handleResponse(res, program.opts().pretty);
  });

reports
  .command('delete <id>')
  .description('删除报告')
  .action(async (id) => {
    const api = getAxios();
    const res = await api.delete(`/reports/${id}`);
    handleResponse(res, program.opts().pretty);
  });

// ── Indicators ──────────────────────────────────────────────────

const indicators = program.command('indicators').description('健康指标管理');

indicators
  .command('list')
  .description('列出指标库')
  .option('--type <type>', '按分类筛选（如：血液常规、生化检查）')
  .option('--search <keyword>', '按名称搜索')
  .action(async (opts) => {
    const api = getAxios();
    const res = await api.get('/indicators');
    if (res.status >= 400) {
      handleResponse(res, program.opts().pretty);
      return;
    }

    let data = res.data.data || [];

    if (opts.type) {
      data = data.filter(ind => ind.type === opts.type);
    }
    if (opts.search) {
      const kw = opts.search.toLowerCase();
      data = data.filter(ind =>
        ind.name.toLowerCase().includes(kw) ||
        (ind.aliases && ind.aliases.some(a => a.toLowerCase().includes(kw)))
      );
    }

    output({ success: true, data, count: data.length }, program.opts().pretty);
  });

indicators
  .command('get <id>')
  .description('获取指标详情')
  .action(async (id) => {
    const api = getAxios();
    const res = await api.get(`/indicators/${id}`);
    handleResponse(res, program.opts().pretty);
  });

indicators
  .command('add')
  .description('添加指标')
  .requiredOption('--name <name>', '指标名称')
  .requiredOption('--type <type>', '分类（如：血液常规）')
  .requiredOption('--value-type <type>', '值类型：numeric 或 qualitative')
  .option('--unit <unit>', '单位')
  .option('--min <n>', '正常范围最小值（数值型）')
  .option('--max <n>', '正常范围最大值（数值型）')
  .option('--min-female <n>', '女性专用最小值')
  .option('--max-female <n>', '女性专用最大值')
  .option('--normal-value <val>', '正常值：positive 或 negative（定性型）')
  .option('--reference-range <text>', '参考范围文本描述')
  .option('--aliases <a1,a2>', 'OCR 匹配别名，逗号分隔')
  .option('--description <text>', '描述')
  .action(async (opts) => {
    const api = getAxios();
    const data = {
      name: opts.name,
      type: opts.type,
      valueType: opts.valueType,
    };
    if (opts.unit) data.unit = opts.unit;
    if (opts.min !== undefined) data.normalMin = parseFloat(opts.min);
    if (opts.max !== undefined) data.normalMax = parseFloat(opts.max);
    if (opts.minFemale !== undefined) data.normalMinFemale = parseFloat(opts.minFemale);
    if (opts.maxFemale !== undefined) data.normalMaxFemale = parseFloat(opts.maxFemale);
    if (opts.normalValue) data.normalValue = opts.normalValue;
    if (opts.referenceRange) data.referenceRange = opts.referenceRange;
    if (opts.description) data.description = opts.description;
    if (opts.aliases) data.aliases = opts.aliases.split(',').map(a => a.trim());

    const res = await api.post('/indicators', data);
    handleResponse(res, program.opts().pretty);
  });

indicators
  .command('update <id>')
  .description('更新指标')
  .option('--name <name>', '指标名称')
  .option('--type <type>', '分类')
  .option('--value-type <type>', '值类型')
  .option('--unit <unit>', '单位')
  .option('--min <n>', '正常范围最小值')
  .option('--max <n>', '正常范围最大值')
  .option('--min-female <n>', '女性专用最小值')
  .option('--max-female <n>', '女性专用最大值')
  .option('--normal-value <val>', '正常值（定性型）')
  .option('--reference-range <text>', '参考范围文本')
  .option('--description <text>', '描述')
  .action(async (id, opts) => {
    const api = getAxios();
    const data = {};
    if (opts.name) data.name = opts.name;
    if (opts.type) data.type = opts.type;
    if (opts.valueType) data.valueType = opts.valueType;
    if (opts.unit !== undefined) data.unit = opts.unit;
    if (opts.min !== undefined) data.normalMin = parseFloat(opts.min);
    if (opts.max !== undefined) data.normalMax = parseFloat(opts.max);
    if (opts.minFemale !== undefined) data.normalMinFemale = parseFloat(opts.minFemale);
    if (opts.maxFemale !== undefined) data.normalMaxFemale = parseFloat(opts.maxFemale);
    if (opts.normalValue !== undefined) data.normalValue = opts.normalValue;
    if (opts.referenceRange !== undefined) data.referenceRange = opts.referenceRange;
    if (opts.description !== undefined) data.description = opts.description;

    const res = await api.put(`/indicators/${id}`, data);
    handleResponse(res, program.opts().pretty);
  });

indicators
  .command('alias <id>')
  .description('管理指标别名（OCR 匹配用）')
  .option('--add <alias>', '添加别名')
  .option('--remove <alias>', '删除别名')
  .action(async (id, opts) => {
    const api = getAxios();
    if (opts.add) {
      const res = await api.post(`/indicators/${id}/alias`, { alias: opts.add });
      handleResponse(res, program.opts().pretty);
    } else if (opts.remove) {
      const res = await api.delete(`/indicators/${id}/alias`, { data: { alias: opts.remove } });
      handleResponse(res, program.opts().pretty);
    } else {
      output({ error: '请指定 --add 或 --remove' }, program.opts().pretty);
      process.exit(1);
    }
  });

indicators
  .command('delete <id>')
  .description('删除指标（仅非默认且无关联数据的指标）')
  .action(async (id) => {
    const api = getAxios();
    const res = await api.delete(`/indicators/${id}`);
    handleResponse(res, program.opts().pretty);
  });

// ── Parse ───────────────────────────────────────────────────────

program.parseAsync().catch((e) => {
  output({ error: e.message }, program.opts().pretty);
  process.exit(1);
});
