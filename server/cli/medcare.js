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
  .command('ocr')
  .description('对文件执行 OCR 识别，返回解析的指标（不创建报告）')
  .requiredOption('--file <path>', '报告文件路径（图片或 PDF）')
  .action(async (opts) => {
    const api = getAxios();
    const filePath = path.resolve(opts.file);

    if (!fs.existsSync(filePath)) {
      output({ error: `文件不存在: ${filePath}` }, program.opts().pretty);
      process.exit(1);
    }

    const form = new FormData();
    form.append('image', fs.createReadStream(filePath));

    const res = await api.post('/ocr/recognize-and-parse', form, {
      headers: { ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (res.status >= 400) {
      handleResponse(res, program.opts().pretty);
      return;
    }

    const ocrData = res.data.data || {};
    const rawIndicators = ocrData.indicators || [];
    const ocrText = ocrData.ocr?.text || '';
    const isPDF = ocrData.isPDF || false;

    // Classify indicators
    const matched = [];
    const unmatched = [];

    for (const ind of rawIndicators) {
      const item = {
        name: ind.name || '',
        value: ind.value || '',
        unit: ind.unit || '',
        referenceRange: ind.referenceRange || '',
        isNormal: ind.isNormal,
        abnormalType: ind.abnormalType || 'normal',
      };

      if (ind.indicatorId) {
        item.indicatorId = ind.indicatorId;
        item.matched = true;
        item.indicatorName = ind.indicatorName || ind.name || '';
        matched.push(item);
      } else {
        item.matched = false;
        unmatched.push(item);
      }
    }

    // Build suggested indicatorData for upload
    const indicatorData = matched.map(ind => ({
      indicatorId: ind.indicatorId,
      value: ind.value,
      referenceRange: ind.referenceRange,
      isNormal: ind.isNormal !== undefined ? ind.isNormal : true,
      abnormalType: ind.abnormalType,
    }));

    output({
      success: true,
      isPDF,
      ocrEngine: ocrData.engine || '',
      totalPages: ocrData.ocr?.totalPages || null,
      summary: {
        total: rawIndicators.length,
        matched: matched.length,
        unmatched: unmatched.length,
      },
      matched,
      unmatched,
      indicatorData,
      ocrText,
    }, program.opts().pretty);
  });

reports
  .command('upload')
  .description('创建报告。指标数据支持两种格式：\n' +
    '  1) 含 indicatorId 的完整数据（来自 ocr 命令）\n' +
    '  2) 仅含 name + value 的简洁格式（Agent 自行识别报告后提供，CLI 自动匹配 ID）')
  .requiredOption('--member <id>', '家庭成员 ID')
  .requiredOption('--file <path>', '报告文件路径')
  .requiredOption('--date <date>', '报告日期 (YYYY-MM-DD)')
  .requiredOption('--indicator-data <json>', '指标数据 JSON 数组')
  .option('--hospital <name>', '医院名称')
  .option('--doctor <name>', '医生姓名')
  .option('--notes <text>', '备注')
  .action(async (opts) => {
    const api = getAxios();
    const pretty = program.opts().pretty;
    const filePath = path.resolve(opts.file);

    if (!fs.existsSync(filePath)) {
      output({ error: `文件不存在: ${filePath}` }, pretty);
      process.exit(1);
    }

    let indicatorData;
    try {
      indicatorData = JSON.parse(opts.indicatorData);
    } catch (e) {
      output({ error: `indicator-data JSON 解析失败: ${e.message}` }, pretty);
      process.exit(1);
    }

    if (!Array.isArray(indicatorData)) {
      output({ error: 'indicator-data 必须是 JSON 数组' }, pretty);
      process.exit(1);
    }

    // Resolve names to indicatorIds for entries that only have name
    const needsMatch = indicatorData.filter(ind => !ind.indicatorId && ind.name);
    if (needsMatch.length > 0) {
      // Fetch all indicators for matching
      const indRes = await api.get('/indicators');
      if (indRes.status >= 400) {
        handleResponse(indRes, pretty);
        return;
      }
      const allIndicators = indRes.data.data || [];

      // Build lookup maps
      const byName = new Map();
      const byAlias = new Map();
      for (const ind of allIndicators) {
        byName.set(ind.name.toLowerCase(), ind);
        if (ind.aliases && Array.isArray(ind.aliases)) {
          for (const alias of ind.aliases) {
            byAlias.set(alias.toLowerCase(), ind);
          }
        }
      }

      for (const item of needsMatch) {
        const key = item.name.toLowerCase();
        const found = byName.get(key) || byAlias.get(key);
        if (found) {
          item.indicatorId = found.id;
          item._matchedName = found.name;
          // Fill in reference range if not provided
          if (!item.referenceRange && found.referenceRange) {
            item.referenceRange = found.referenceRange;
          }
        }
      }
    }

    // Separate resolved vs unresolved
    const resolved = indicatorData.filter(ind => ind.indicatorId);
    const unresolved = indicatorData.filter(ind => !ind.indicatorId);

    if (unresolved.length > 0) {
      output({
        error: `${unresolved.length} 个指标无法匹配到指标库`,
        hint: '请先通过 "medcare indicators add" 添加缺失指标，或通过 "medcare indicators list --search" 查找正确的名称',
        unresolvedIndicators: unresolved.map(ind => ({
          name: ind.name,
          value: ind.value,
          unit: ind.unit || '',
        })),
        resolvedCount: resolved.length,
      }, pretty);
      process.exit(1);
    }

    // Clean up internal fields
    const cleanData = resolved.map(ind => {
      const clean = {
        indicatorId: ind.indicatorId,
        value: ind.value,
      };
      if (ind.referenceRange) clean.referenceRange = ind.referenceRange;
      if (ind.isNormal !== undefined) clean.isNormal = ind.isNormal;
      if (ind.abnormalType) clean.abnormalType = ind.abnormalType;
      if (ind.notes) clean.notes = ind.notes;
      return clean;
    });

    const form = new FormData();
    form.append('familyMemberId', opts.member);
    form.append('reportDate', opts.date);
    if (opts.hospital) form.append('hospitalName', opts.hospital);
    if (opts.doctor) form.append('doctorName', opts.doctor);
    if (opts.notes) form.append('notes', opts.notes);
    form.append('indicatorData', JSON.stringify(cleanData));
    form.append('file', fs.createReadStream(filePath));

    const res = await api.post('/reports', form, {
      headers: { ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Attach match summary to response for agent visibility
    const matchNames = resolved.filter(ind => ind._matchedName);
    if (matchNames.length > 0 && res.data.success) {
      const result = { ...res.data };
      result._matchSummary = {
        totalIndicators: cleanData.length,
        autoMatchedByName: matchNames.map(ind => ({
          providedName: ind.name,
          matchedTo: ind._matchedName,
          indicatorId: ind.indicatorId,
        })),
      };
      output(result, pretty);
    } else {
      handleResponse(res, pretty);
    }
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
