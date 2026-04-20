# MedCare CLI Skill

MedCare 提供命令行工具 `medcare`，可以让 AI Agent 通过 Bash 命令操作家庭健康管理系统，实现自动化报告录入、指标查询、数据管理等功能。

## 前置条件

1. MedCare 服务已启动
2. 已安装 CLI 工具：`cd server && npm link`
3. 已登录：`medcare login -s http://localhost:3001 -u <user> -p <password>`

## 命令参考

所有命令默认输出 JSON，追加 `--pretty` 可格式化输出。

### 家庭成员

```bash
medcare members list                                          # 列出所有成员
medcare members get <id>                                      # 查看成员详情
medcare members add --name <n> --gender <g> --relationship <r> [options]
```

### 医疗报告

```bash
medcare reports list [--member <id>] [--hospital <name>]      # 报告列表
medcare reports get <id>                                      # 报告详情（含指标）
medcare reports delete <id>                                   # 删除报告
```

#### OCR 识别（不创建报告）

```bash
medcare reports ocr --file <path>
```

返回 `matched`（已匹配指标）和 `unmatched`（未匹配指标），以及可直接用于上传的 `indicatorData` 数组。

#### 上传报告

```bash
medcare reports upload \
  --member <id> \
  --file <path> \
  --date 2026-04-20 \
  --indicator-data '[{"indicatorId":1,"value":"120","isNormal":true}]' \
  [--hospital <name>] [--doctor <name>] [--notes <text>]
```

`--indicator-data` 支持两种格式：
- 含 `indicatorId` 的完整数据（推荐，最可靠）
- 仅含 `name` + `value` 的简洁格式（CLI 自动匹配指标库）

### 健康指标

```bash
medcare indicators list [--type <分类>] [--search <关键词>]    # 查询指标库
medcare indicators get <id>                                    # 指标详情
medcare indicators add --name <n> --type <t> --value-type <numeric|qualitative> [options]
medcare indicators update <id> [options]
medcare indicators delete <id>
medcare indicators alias <id> --add <别名>                     # 添加 OCR 匹配别名
medcare indicators alias <id> --remove <别名>
```

`add` 可选参数：`--unit`, `--min`, `--max`, `--min-female`, `--max-female`, `--normal-value`, `--reference-range`, `--aliases <a1,a2>`, `--description`

## 推荐工作流

### Agent 自带识别能力（推荐）

当 Agent 能够自行识别报告内容时：

```bash
# 1. 查询指标获取精确 ID
medcare indicators list --search "白细胞"

# 2. 使用精确 ID 上传（最可靠）
medcare reports upload --member 1 --file report.jpg --date 2026-04-20 \
  --indicator-data '[{"indicatorId":5,"value":"6.5","isNormal":true}]'
```

### 使用系统 OCR 识别

当需要系统进行 OCR 识别时：

```bash
# 1. OCR 预览
medcare reports ocr --file report.jpg --pretty

# 2. 确认结果后上传（使用返回的 indicatorData）
medcare reports upload --member 1 --file report.jpg --date 2026-04-20 \
  --indicator-data '<OCR 返回的 indicatorData>'
```

### 处理未匹配指标

当指标无法自动匹配时：

```bash
# 1. 搜索正确的指标名
medcare indicators list --search "尿酸"

# 2. 若指标库中不存在，先新建
medcare indicators add --name "尿酸" --type "生化检查" --value-type numeric \
  --unit "μmol/L" --min 208 --max 428

# 3. 使用新指标 ID 重新上传
medcare reports upload --member 1 --file report.jpg --date 2026-04-20 \
  --indicator-data '[{"indicatorId":<新ID>,"value":"350"}]'
```

## 注意事项

- 日期格式统一使用 `YYYY-MM-DD`
- 文件上传支持图片（PNG、JPG）和 PDF
- PDF 文字提取仅支持文本型 PDF，扫描版 PDF 会返回错误提示
- 建议始终使用精确 `indicatorId` 上传，避免名称匹配歧义
