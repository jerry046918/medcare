---
name: medcare-cli
description: Use when managing family health data via CLI - querying members, reports, indicators, uploading medical reports, or performing OCR on report files
---

# MedCare CLI

## Overview

MedCare CLI (`medcare`) is a command-line tool for interacting with the MedCare family health management system. All output is JSON by default. Append `--pretty` for human-readable output.

## Setup

```bash
medcare login -s http://localhost:3001 -u <username> -p <password>
```

Credentials are saved to `~/.medcare/config.json`.

## Commands

### Members

```bash
medcare members list                          # List all family members
medcare members get <id>                      # Get member details
medcare members add --name <n> --gender <g> --relationship <r> [--birthday <date>] [--height <cm>] [--weight <kg>]
```

### Reports

```bash
medcare reports list [--member <id>] [--hospital <name>]
medcare reports get <id>                      # Report with indicator data
medcare reports delete <id>
```

#### OCR Preview (no report created)

```bash
medcare reports ocr --file <path>
```

Returns matched/unmatched indicators and `indicatorData` array ready for upload. Use this when the system should handle OCR.

#### Upload Report

```bash
medcare reports upload \
  --member <id> \
  --file <path> \
  --date 2026-04-20 \
  --indicator-data '[{"indicatorId":1,"value":"120","isNormal":true}]' \
  [--hospital <name>] [--doctor <name>] [--notes <text>]
```

The `--indicator-data` accepts either:
- Objects with `indicatorId` (from OCR or manual lookup) - used directly
- Objects with only `name` + `value` - CLI auto-matches to indicator library

### Indicators

```bash
medcare indicators list [--type <category>] [--search <keyword>]
medcare indicators get <id>
medcare indicators add --name <n> --type <t> --value-type <numeric|qualitative> [options]
medcare indicators update <id> [options]
medicators indicators delete <id>
medcare indicators alias <id> --add <alias>   # Add OCR match alias
medcare indicators alias <id> --remove <alias>
```

Indicator `add` options: `--unit`, `--min`, `--max`, `--min-female`, `--max-female`, `--normal-value`, `--reference-range`, `--aliases <a1,a2>`, `--description`

## Recommended Agent Workflows

### Workflow 1: Agent has its own OCR capability

When you can read/recognize the report yourself:

1. **Query indicators** to find exact IDs:
   ```bash
   medcare indicators list --search "白细胞"
   ```
2. **Upload with exact IDs** (most reliable):
   ```bash
   medcare reports upload --member 1 --file report.jpg --date 2026-04-20 \
     --indicator-data '[{"indicatorId":5,"value":"6.5","isNormal":true},{"indicatorId":6,"value":"130","isNormal":true}]'
   ```

### Workflow 2: Use system OCR

When you want the system to handle recognition:

1. **Run OCR** to preview results:
   ```bash
   medcare reports ocr --file report.jpg --pretty
   ```
2. **Review** the `matched` indicators and `indicatorData` in output
3. **Upload** using the returned indicatorData:
   ```bash
   medcare reports upload --member 1 --file report.jpg --date 2026-04-20 \
     --indicator-data '<indicatorData from OCR result>'
   ```

### Workflow 3: Handle unmatched indicators

If OCR or name matching fails for some indicators:

1. **Search** for the correct name:
   ```bash
   medcare indicators list --search "尿酸"
   ```
2. **Add missing indicator** if not found:
   ```bash
   medcare indicators add --name "尿酸" --type "生化检查" --value-type numeric \
     --unit "μmol/L" --min 208 --max 428 --aliases "尿酸,UA"
   ```
3. **Retry upload** with the new indicatorId

## Key Points

- Always use exact `indicatorId` when possible for reliable uploads
- The `indicatorData` field must be a valid JSON array
- All date fields use `YYYY-MM-DD` format
- File uploads support images (PNG, JPG) and PDF
- PDF text extraction works for text-based PDFs; scanned PDFs will produce an error message
