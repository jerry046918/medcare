# MedCare CLI Skill

MedCare 提供命令行工具 `medcare`，可以让 AI Agent 通过 Bash 命令操作家庭健康管理系统，实现自动化报告录入、指标查询、成员/授权管理等功能。

## 前置条件

1. MedCare 服务已启动
2. 已安装 CLI 工具：`cd server && npm link`
3. 已登录：`medcare login -s http://localhost:3001 -u <user> -p <password>`

## 命令参考

所有命令默认输出 JSON，追加 `--pretty` 可格式化输出。命令请求的 API 为 v2 路径（成员资源为 `/api/members`，旧的 `/api/family-members` 已移除）。

### 登录

```bash
medcare login -s http://localhost:3001 -u <user> -p <password>   # 登录并保存凭证（~/.medcare/config.json）
```

### 家庭成员

```bash
medcare members list                                          # 列出当前账户可见成员（含视角 role/relationship、reportCount）
medcare members get <id>                                      # 查看成员详情
medcare members add --name <n> --gender <男|女|其他> --relationship <r> [--birthday YYYY-MM-DD] [--height cm] [--weight kg] [--phone <p>]
```

`members list` 返回项中的 `role` 是当前账户对该成员的视角：`self`（本人）/ `owner`（代管人）/ `editor` / `viewer`；可见范围由授权矩阵决定，只看得到本人及被授权的成员。

### 邀请码（admin）

```bash
medcare invites create [--member <id>] [--uses <n>] [--days <n>]   # 生成邀请码
medcare invites list                                               # 列出邀请码（含创建人/专属成员/使用情况）
```

- `--member <id>`：生成绑定专属成员的邀请码，注册时只能认领该成员（该成员须未被本人账户绑定）
- `--uses <n>`：可用次数，默认 1
- `--days <n>`：有效天数（不填则永久有效）

新用户携邀请码注册后即可见其本人成员；需要让已有账户认领成员或授权时，见下方 `access` 与 `users` 命令。

### 授权管理

```bash
medcare access grant --member <id> --user <id> --role <viewer|editor> [--relationship <r>]   # 授权用户访问成员
medcare access revoke --member <id> --link <linkId>                                          # 撤销授权
```

- `access grant`：`--user` 是被授权用户的 ID（用 `users list` 查询）；`--role` 仅支持 `viewer`（只读）和 `editor`（可编辑）
- `access revoke`：`--link` 是授权记录 ID（先 `GET /api/members/:id/links` 或看 grant 返回值）；link 与 `--member` 不匹配时 CLI 会列出该成员现有授权
- 成员的现有授权可通过 `GET /api/members/:id/links` 查看（如 `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/members/1/links`）

### 用户

```bash
medcare users list                                            # 列出用户；admin 额外返回 role/createdAt/selfMember
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

### 新用户接入（admin）

```bash
# 1. 生成邀请码（7 天有效）
medcare invites create --days 7 --pretty

# 2. 把邀请码交给对方，在 Web 注册页完成注册（新建本人成员或认领已有成员）

# 3. 查看新用户 ID，并授权其查看某个成员
medcare users list
medcare access grant --member 2 --user 3 --role viewer
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
- 邀请码创建/列出、用户角色管理为 admin 专属；`members`/`reports` 结果按当前账户可见性过滤
