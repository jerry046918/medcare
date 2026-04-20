# Unified Report Upload + OCR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge file upload and OCR into a single unified flow — selecting a report attachment (image or PDF) automatically triggers OCR and populates the indicator table.

**Architecture:** Frontend uploads file to existing OCR endpoint → receives parsed indicators → populates table directly (matched indicators auto-filled, unmatched shown with "待确认" badge for inline matching/creation). Report submission sends file again via multer to reports endpoint. Backend adds PDF text extraction via pdfjs-dist, report file storage, and file cleanup.

**Tech Stack:** React 18, Ant Design 5, Redux Toolkit, Express.js, Sequelize, multer, pdfjs-dist

**Design deviation:** The spec calls for PDF-to-image conversion, but the `canvas` npm package requires native binaries (problematic on Windows/Docker). Instead, we use pdfjs-dist for text extraction from text-based PDFs. For scanned/image-based PDFs, the system shows a clear message asking the user to upload a screenshot instead. Most hospital reports in China use text-based PDFs, so this covers the common case.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/scripts/updateReportFileFields.js` | Create | DB migration: rename column, add column, create dir |
| `server/models/MedicalReport.js` | Modify | Rename pdfPath → filePath, add fileName |
| `server/services/ocrService.js` | Modify | Add `processPDF()` standalone function using pdfjs-dist |
| `server/routes/ocr.js` | Modify | Extend recognize-and-parse to handle PDF |
| `server/routes/reports.js` | Modify | Add multer, file storage, file cleanup on delete/update |
| `client/src/services/reportAPI.js` | Modify | Update `create` and `update` methods for FormData with `reportFile` |
| `client/src/pages/Reports/ReportUpload.js` | Modify | Unified upload + auto-OCR, inline indicator matching |
| `client/src/pages/Reports/ReportEdit.js` | Modify | Same unified upload + auto-OCR changes |
| `client/src/pages/Reports/ReportDetail.js` | Modify | Update pdfPath → filePath, add download via `/api/files/reports/:filename` |
| `client/src/components/OCRReportRecognition.js` | Delete | Logic absorbed into upload pages |

**Note on `reportSlice.js`:** The existing thunks (`createReport`, `updateReport`) pass data through to `reportAPI.create/update`, which already handles FormData vs JSON internally. No changes needed to the Redux slice.

---

### Task 1: Database Migration — Report File Fields

**Files:**
- Create: `server/scripts/updateReportFileFields.js`

Run migration FIRST, then update model. This avoids Sequelize errors from model-database mismatch.

- [ ] **Step 1: Create migration script**

Create `server/scripts/updateReportFileFields.js`:

```js
const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');
const { db: dbConfig } = require('../config');

async function migrate() {
  // Use a separate Sequelize instance to avoid model registration issues
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbConfig.storage,
    logging: false
  });

  const queryInterface = sequelize.getQueryInterface();

  // Create uploads/reports directory
  const uploadDir = path.join(__dirname, '../uploads/reports');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('[Migration] Created directory:', uploadDir);
  }

  // Check current table structure
  const tableDesc = await queryInterface.describeTable('medical_reports');

  if ('pdfPath' in tableDesc && !('filePath' in tableDesc)) {
    await queryInterface.renameColumn('medical_reports', 'pdfPath', 'filePath');
    console.log('[Migration] Renamed pdfPath → filePath');
  }

  if (!('fileName' in tableDesc)) {
    await queryInterface.addColumn('medical_reports', 'fileName', {
      type: DataTypes.STRING,
      allowNull: true
    });
    console.log('[Migration] Added fileName column');
  }

  console.log('[Migration] Done');
  await sequelize.close();
}

migrate().catch(err => {
  console.error('[Migration] Error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run migration**

```bash
cd server && node scripts/updateReportFileFields.js
```

Expected output:
```
[Migration] Renamed pdfPath → filePath
[Migration] Added fileName column
[Migration] Done
```

- [ ] **Step 3: Update MedicalReport model**

In `server/models/MedicalReport.js`, replace lines 32-36:

```js
pdfPath: {
  type: DataTypes.STRING,
  allowNull: true,
  comment: 'PDF报告文件路径'
},
```

With:

```js
filePath: {
  type: DataTypes.STRING,
  allowNull: true,
  comment: '报告附件文件路径'
},
fileName: {
  type: DataTypes.STRING,
  allowNull: true,
  comment: '原始文件名'
}
```

- [ ] **Step 4: Commit**

```bash
git add server/scripts/updateReportFileFields.js server/models/MedicalReport.js
git commit -m "feat: migrate report model — rename pdfPath to filePath, add fileName"
```

---

### Task 2: Backend — PDF Text Extraction via pdfjs-dist

**Files:**
- Modify: `server/services/ocrService.js`
- Modify: `server/package.json`

- [ ] **Step 1: Install pdfjs-dist**

```bash
cd server && npm install pdfjs-dist@4.4.168
```

- [ ] **Step 2: Add processPDF function to ocrService.js**

Add at the top of `server/services/ocrService.js` (after the existing requires, around line 12):

```js
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
```

If the `.mjs` import fails on your Node version, try:

```js
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
```

Add this standalone function BEFORE the `OCRService` class definition (around line 23), NOT as a method on the class:

```js
/**
 * 从 PDF 文件中提取文字（文本型 PDF）
 * 对于扫描型 PDF，返回错误提示用户上传图片
 */
async function processPDF(pdfBuffer, options = {}) {
  try {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const numPages = doc.numPages;
    const pageTexts = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      pageTexts.push({ page: i, text: pageText });
    }

    const combinedText = pageTexts
      .filter(p => p.text.trim())
      .map(p => p.text)
      .join('\n\n');

    if (!combinedText.trim()) {
      return {
        success: false,
        text: '',
        totalPages: numPages,
        error: '该PDF为图片型文档，无法提取文字。请上传报告截图或照片以获得更好的识别效果。'
      };
    }

    return {
      success: true,
      text: combinedText,
      totalPages: numPages,
      pageResults: pageTexts
    };
  } catch (error) {
    throw new Error(`PDF处理失败: ${error.message}`);
  }
}
```

Update the `module.exports` at line 448 to include `processPDF`:

```js
module.exports = {
  ocrService,
  processPDF,
  OCR_ENGINE,
  BaseOCREngine,
  PaddleOCREngine,
  OpenAIVisionEngine,
  BaiduOCREngine,
  TencentOCREngine
};
```

- [ ] **Step 3: Verify no import errors**

```bash
cd server && node -e "const { processPDF } = require('./services/ocrService'); console.log('processPDF type:', typeof processPDF)"
```

Expected: `processPDF type: function`

- [ ] **Step 4: Commit**

```bash
git add server/services/ocrService.js server/package.json server/package-lock.json
git commit -m "feat: add PDF text extraction via pdfjs-dist for OCR processing"
```

---

### Task 3: Backend — Extend OCR Endpoint for PDF

**Files:**
- Modify: `server/routes/ocr.js` (the recognize-and-parse endpoint, lines 265-360)

- [ ] **Step 1: Import processPDF**

At the top of `server/routes/ocr.js`, update line 12 to destructure `processPDF`:

```js
const { ocrService, OCR_ENGINE, processPDF } = require('../services/ocrService');
```

(Remove the old destructuring of just `{ ocrService, OCR_ENGINE }`.)

Wait — the current line 12 is:

```js
const { ocrService, OCR_ENGINE } = require('../services/ocrService');
```

Change to:

```js
const { ocrService, OCR_ENGINE, processPDF } = require('../services/ocrService');
```

- [ ] **Step 2: Replace OCR processing logic in recognize-and-parse**

In the POST `/recognize-and-parse` handler, REPLACE lines 321-328 (the existing OCR recognize + parse calls):

```js
// 1. 执行 OCR 识别
const ocrResult = await service.recognize(imageBuffer, {
  engine: useEngine,
  mimeType: req.file.mimetype
});

// 2. 解析指标
const parseResult = await processOCRResult({ text: ocrResult.text });
```

With:

```js
const isPDF = req.file.mimetype === 'application/pdf' ||
              req.file.originalname?.toLowerCase().endsWith('.pdf');

let ocrResult;
let parseResult;

if (isPDF) {
  // PDF — extract text directly
  const pdfResult = await processPDF(imageBuffer);

  if (!pdfResult.success) {
    try { await fs.unlink(safePath); } catch (e) {}
    return res.json({
      success: false,
      message: pdfResult.error || 'PDF文字提取失败',
      data: { totalPages: pdfResult.totalPages }
    });
  }

  ocrResult = {
    success: true,
    text: pdfResult.text,
    engine: 'pdf-extract',
    totalPages: pdfResult.totalPages
  };
  parseResult = await processOCRResult({ text: pdfResult.text });
} else {
  // Image — existing OCR flow
  ocrResult = await service.recognize(imageBuffer, {
    engine: useEngine,
    mimeType: req.file.mimetype
  });
  parseResult = await processOCRResult({ text: ocrResult.text });
}
```

Also update the response (lines 337-344) to include `isPDF`:

```js
res.json({
  success: true,
  data: {
    ocr: ocrResult,
    indicators: parseResult,
    engine: useEngine,
    isPDF
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/ocr.js
git commit -m "feat: extend OCR recognize-and-parse to handle PDF files"
```

---

### Task 4: Backend — Report File Upload & Cleanup

**Files:**
- Modify: `server/routes/reports.js`

- [ ] **Step 1: Add multer imports and config**

At the top of `server/routes/reports.js`, add after line 4:

```js
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
```

After the `withTransaction` function (after line 44), add:

```js
// Report file upload configuration
const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/reports');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf'];
    if (!safeExts.includes(ext)) {
      return cb(new Error('不支持的文件类型'));
    }
    const safeName = `report-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, safeName);
  }
});

const reportUpload = multer({
  storage: reportStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});
```

- [ ] **Step 2: Update POST endpoint for file upload**

Change line 146:

```js
router.post('/', authenticateToken, async (req, res) => {
```

To:

```js
router.post('/', authenticateToken, reportUpload.single('file'), async (req, res) => {
```

**Important:** When multer middleware is present but the request is `application/json` (no file), multer passes through cleanly — `req.file` is `undefined`, `req.body` is parsed normally by express.json(). This handles the no-file case.

Replace the destructuring at line 147:

```js
const { familyMemberId, reportDate, hospitalName, doctorName, notes, indicatorData } = req.body;
```

With:

```js
const { familyMemberId, reportDate, hospitalName, doctorName, notes } = req.body;

// Parse indicatorData: FormData sends as JSON string, JSON body sends as array
const indicatorData = req.body.indicatorData
  ? (typeof req.body.indicatorData === 'string'
    ? JSON.parse(req.body.indicatorData)
    : req.body.indicatorData)
  : [];
```

In the `MedicalReport.create` call (lines 196-202), add file fields:

```js
const report = await MedicalReport.create({
  memberId: validFamilyMemberId,
  reportDate,
  hospitalName: sanitizedData.hospitalName,
  doctorName: sanitizedData.doctorName,
  notes: sanitizedData.notes,
  filePath: req.file ? `uploads/reports/${req.file.filename}` : null,
  fileName: req.file ? req.file.originalname : null
}, { transaction });
```

- [ ] **Step 3: Update PUT endpoint for file upload**

Change line 302:

```js
router.put('/:id', authenticateToken, async (req, res) => {
```

To:

```js
router.put('/:id', authenticateToken, reportUpload.single('file'), async (req, res) => {
```

Replace the destructuring at line 313:

```js
const { reportDate, hospitalName, doctorName, notes, indicatorData } = req.body;
```

With:

```js
const { reportDate, hospitalName, doctorName, notes } = req.body;
const indicatorData = req.body.indicatorData
  ? (typeof req.body.indicatorData === 'string'
    ? JSON.parse(req.body.indicatorData)
    : req.body.indicatorData)
  : null;
```

In the update call (lines 348-353), capture old file path BEFORE updating, then include new file:

```js
// Save old file path before update
const oldFilePath = report.filePath;

const updateFields = {
  reportDate: reportDate || report.reportDate,
  hospitalName: hospitalName !== undefined ? sanitizedData.hospitalName : report.hospitalName,
  doctorName: doctorName !== undefined ? sanitizedData.doctorName : report.doctorName,
  notes: notes !== undefined ? sanitizedData.notes : report.notes
};

// If new file uploaded, update file fields
if (req.file) {
  updateFields.filePath = `uploads/reports/${req.file.filename}`;
  updateFields.fileName = req.file.originalname;
}

await report.update(updateFields, { transaction });
```

After the update, add old file cleanup (inside the transaction callback, after the update):

```js
// Clean up old file if replaced
if (req.file && oldFilePath) {
  const fullPath = path.join(__dirname, '..', oldFilePath);
  try { await fs.unlink(fullPath); } catch (e) {
    console.warn('[Reports] Failed to delete old file:', e.message);
  }
}
```

- [ ] **Step 4: Add file cleanup to DELETE endpoint**

In the delete handler, BEFORE `await report.destroy()` (around line 461), add:

```js
// Delete associated file
if (report.filePath) {
  const filePath = path.join(__dirname, '..', report.filePath);
  try { await fs.unlink(filePath); } catch (e) {
    console.warn('[Reports] Failed to delete report file:', e.message);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/reports.js
git commit -m "feat: add file upload support to report CRUD with cleanup"
```

---

### Task 5: Frontend — Update reportAPI.js

**Files:**
- Modify: `client/src/services/reportAPI.js`

- [ ] **Step 1: Update create and update methods**

Replace the entire `reportAPI` object (lines 3-55) with:

```js
const reportAPI = {
  getAll: () => {
    return api.get('/reports');
  },

  getById: (id) => {
    return api.get(`/reports/${id}`);
  },

  create: (reportData) => {
    if (reportData.reportFile instanceof File) {
      const formData = new FormData();

      formData.append('familyMemberId', reportData.familyMemberId);
      formData.append('reportDate', reportData.reportDate);
      if (reportData.hospitalName) formData.append('hospitalName', reportData.hospitalName);
      if (reportData.doctorName) formData.append('doctorName', reportData.doctorName);
      if (reportData.notes) formData.append('notes', reportData.notes);

      if (reportData.indicatorData && reportData.indicatorData.length > 0) {
        formData.append('indicatorData', JSON.stringify(reportData.indicatorData));
      }

      formData.append('file', reportData.reportFile);

      return api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }

    return api.post('/reports', reportData);
  },

  update: (id, reportData) => {
    if (reportData.reportFile instanceof File) {
      const formData = new FormData();

      formData.append('familyMemberId', reportData.familyMemberId);
      formData.append('reportDate', reportData.reportDate);
      if (reportData.hospitalName) formData.append('hospitalName', reportData.hospitalName);
      if (reportData.doctorName) formData.append('doctorName', reportData.doctorName);
      if (reportData.notes) formData.append('notes', reportData.notes);

      if (reportData.indicatorData && reportData.indicatorData.length > 0) {
        formData.append('indicatorData', JSON.stringify(reportData.indicatorData));
      }

      formData.append('file', reportData.reportFile);

      return api.put(`/reports/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }

    return api.put(`/reports/${id}`, reportData);
  },

  delete: (id) => {
    return api.delete(`/reports/${id}`);
  },
};
```

Key change: `pdfFile` → `reportFile` in the property name, `formData.append('file', ...)` matches the multer field name.

- [ ] **Step 2: Commit**

```bash
git add client/src/services/reportAPI.js
git commit -m "feat: update reportAPI to use reportFile property and support FormData for update"
```

---

### Task 6: Frontend — Rewrite ReportUpload.js

**Files:**
- Modify: `client/src/pages/Reports/ReportUpload.js`

- [ ] **Step 1: Update imports**

Replace lines 4-30 with:

```js
import {
  Card,
  Form,
  Input,
  DatePicker,
  Select,
  Button,
  Upload,
  Space,
  message,
  Divider,
  Row,
  Col,
  Table,
  Popconfirm,
  Tag,
  Alert,
  Modal
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  InboxOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RedoOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { createReport } from '../../store/slices/reportSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';
import { fetchIndicators } from '../../store/slices/indicatorSlice';
import HospitalAutoComplete from '../../components/common/HospitalAutoComplete';
import ocrAPI from '../../services/ocrAPI';
```

Removed: `OCRReportRecognition`, `ScanOutlined`, `RobotOutlined`, `UploadOutlined`, `FileImageOutlined`, `EyeOutlined`. Added: `Alert`, `Modal`, `LoadingOutlined`, `CheckCircleOutlined`, `CloseCircleOutlined`, `RedoOutlined`.

- [ ] **Step 2: Replace state variables**

Replace lines 52-55:

```js
const [indicatorData, setIndicatorData] = useState([]);
const [fileList, setFileList] = useState([]);
const [ocrModalVisible, setOcrModalVisible] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
```

With:

```js
const [indicatorData, setIndicatorData] = useState([]);
const [reportFile, setReportFile] = useState(null);
const [ocrStatus, setOcrStatus] = useState('idle'); // idle | recognizing | success | error
const [ocrResult, setOcrResult] = useState(null);
const [ocrError, setOcrError] = useState(null);
const [ocrRawText, setOcrRawText] = useState('');
const [showRawText, setShowRawText] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
```

- [ ] **Step 3: Replace handleOCRConfirm with new OCR functions**

Delete the entire `handleOCRConfirm` function (lines 148-232). Replace with these three functions:

```js
// Auto-trigger OCR when file is selected
const handleFileSelect = async (file) => {
  const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
  if (!isValidType) {
    message.error('仅支持图片和PDF文件');
    return false;
  }
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    message.error('文件大小不能超过10MB');
    return false;
  }

  setReportFile(file);
  setOcrStatus('recognizing');
  setOcrError(null);
  setOcrRawText('');

  try {
    const response = await ocrAPI.recognizeAndParse(file);
    if (response.success && response.data) {
      setOcrStatus('success');
      setOcrResult(response.data);
      setOcrRawText(response.data.ocr?.text || '');

      if (response.data.indicators && response.data.indicators.length > 0) {
        populateIndicatorsFromOCR(response.data.indicators);
      }
    } else {
      setOcrStatus('error');
      setOcrError(response.message || 'OCR识别失败');
    }
  } catch (error) {
    setOcrStatus('error');
    setOcrError(error.response?.data?.message || error.message || 'OCR识别失败');
  }

  return false; // Prevent default upload
};

// Populate indicator table from OCR results
const populateIndicatorsFromOCR = (parsedIndicators) => {
  const newItems = [];

  for (let i = 0; i < parsedIndicators.length; i++) {
    const item = parsedIndicators[i];
    newItems.push({
      id: Date.now() + i,
      indicatorId: item.indicatorId || null,
      value: item.value || '',
      referenceRange: item.referenceRange || '',
      isNormal: item.isNormal !== undefined ? item.isNormal : null,
      abnormalType: item.abnormalType || 'normal',
      notes: item.notes || '',
      ocrMatched: !!item.indicatorId,
      ocrName: item.name || ''
    });
  }

  setIndicatorData(prev => [...prev, ...newItems]);
  const matched = newItems.filter(i => i.ocrMatched).length;
  const unmatched = newItems.filter(i => !i.ocrMatched).length;
  message.success(`识别出 ${newItems.length} 个指标（${matched} 个已匹配，${unmatched} 个待确认）`);
};

// Create new indicator inline from unmatched OCR result
const handleCreateNewIndicator = async (rowId, indicatorInfo) => {
  try {
    const response = await ocrAPI.createIndicator({
      name: indicatorInfo.name,
      unit: indicatorInfo.unit || '',
      type: indicatorInfo.type || '血液',
      valueType: 'numeric',
      normalMin: indicatorInfo.normalMin,
      normalMax: indicatorInfo.normalMax,
      referenceRange: indicatorInfo.normalMin && indicatorInfo.normalMax
        ? `${indicatorInfo.normalMin}-${indicatorInfo.normalMax}`
        : '',
      isDefault: false
    });

    if (response.success && response.data) {
      dispatch(fetchIndicators());
      handleIndicatorChange(rowId, 'indicatorId', response.data.id);
      message.success(`指标 "${indicatorInfo.name}" 创建成功`);
    }
  } catch (error) {
    message.error(`创建指标失败: ${error.message}`);
  }
};
```

- [ ] **Step 4: Update indicatorColumns**

Replace the entire `indicatorColumns` definition (lines 351-479) with:

```js
const indicatorColumns = [
  {
    title: '指标名称',
    dataIndex: 'indicatorId',
    key: 'indicatorId',
    width: 240,
    render: (value, record) => (
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        <Select
          placeholder="选择指标"
          style={{ width: '100%' }}
          value={value || undefined}
          status={record.ocrMatched === false && !value ? 'warning' : undefined}
          onChange={(val) => {
            handleIndicatorChange(record.id, 'indicatorId', val);
            const indicator = indicators.find(ind => ind.id === val);
            if (indicator) {
              handleIndicatorChange(record.id, 'referenceRange', indicator.referenceRange || '');
            }
            setIndicatorData(prev => prev.map(item =>
              item.id === record.id ? { ...item, ocrMatched: true } : item
            ));
            if (record.ocrName) {
              ocrAPI.confirmMatch(val, record.ocrName).catch(() => {});
            }
          }}
          showSearch
          optionFilterProp="label"
          filterOption={(input, option) =>
            option?.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }
          dropdownRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: '4px 0' }} />
              <Button
                type="link"
                icon={<PlusOutlined />}
                style={{ padding: '4px 8px', width: '100%', textAlign: 'left' }}
                onClick={() => {
                  Modal.confirm({
                    title: '新建指标',
                    content: `将创建指标 "${record.ocrName || '未命名'}"`,
                    onOk: () => handleCreateNewIndicator(record.id, {
                      name: record.ocrName || '',
                      unit: record.ocrUnit || '',
                    })
                  });
                }}
              >
                新建指标...
              </Button>
            </>
          )}
          options={indicators.map(indicator => ({
            value: indicator.id,
            label: `${indicator.name} (${indicator.unit})`
          }))}
        />
        {record.ocrMatched === false && !value && (
          <Tag color="orange" style={{ fontSize: 11 }}>待确认: {record.ocrName}</Tag>
        )}
      </Space>
    )
  },
  {
    title: '检测值',
    dataIndex: 'value',
    key: 'value',
    width: 120,
    render: (value, record) => {
      const indicator = indicators.find(ind => ind.id === record.indicatorId);

      if (indicator?.valueType === 'qualitative') {
        return (
          <Select
            placeholder="选择结果"
            value={value}
            onChange={(val) => handleIndicatorChange(record.id, 'value', val)}
            style={{ width: '100%' }}
          >
            <Option value="positive">阳性</Option>
            <Option value="negative">阴性</Option>
          </Select>
        );
      }

      return (
        <Input
          placeholder="输入数值"
          value={value}
          onChange={(e) => handleIndicatorChange(record.id, 'value', e.target.value)}
        />
      );
    }
  },
  {
    title: '参考范围',
    dataIndex: 'referenceRange',
    key: 'referenceRange',
    width: 150,
    render: (value, record) => (
      <Input
        placeholder="如: 3.9-6.1"
        value={value}
        onChange={(e) => handleIndicatorChange(record.id, 'referenceRange', e.target.value)}
      />
    )
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render: (_, record) => {
      const { isNormal, abnormalType } = record;

      if (isNormal === true || abnormalType === 'normal') {
        return <Tag color="green">正常</Tag>;
      } else if (abnormalType === 'high') {
        return <Tag color="red">偏高</Tag>;
      } else if (abnormalType === 'low') {
        return <Tag color="orange">偏低</Tag>;
      } else if (abnormalType === 'abnormal') {
        return <Tag color="red">异常</Tag>;
      } else if (isNormal === false) {
        return <Tag color="red">异常</Tag>;
      }

      return <Tag color="default">未判断</Tag>;
    }
  },
  {
    title: '备注',
    dataIndex: 'notes',
    key: 'notes',
    render: (value, record) => (
      <Input
        placeholder="备注信息"
        value={value}
        onChange={(e) => handleIndicatorChange(record.id, 'notes', e.target.value)}
      />
    )
  },
  {
    title: '操作',
    key: 'action',
    width: 80,
    render: (_, record) => (
      <Popconfirm
        title="确定删除这个指标吗？"
        onConfirm={() => handleRemoveIndicator(record.id)}
        okText="确定"
        cancelText="取消"
      >
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          size="small"
        />
      </Popconfirm>
    )
  }
];
```

- [ ] **Step 5: Replace upload section JSX**

Replace lines 562-573 (the "PDF文件上传" Dragger section) with:

```jsx
<Divider>报告附件（上传后自动识别）</Divider>
<Form.Item label="报告文件">
  <Dragger
    name="file"
    multiple={false}
    fileList={reportFile ? [{
      uid: '-1',
      name: reportFile.name,
      status: 'done'
    }] : []}
    beforeUpload={(file) => handleFileSelect(file)}
    onRemove={() => {
      setReportFile(null);
      setOcrStatus('idle');
      setOcrResult(null);
    }}
    accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf"
  >
    <p className="ant-upload-drag-icon">
      <InboxOutlined />
    </p>
    <p className="ant-upload-text">点击或拖拽上传报告文件</p>
    <p className="ant-upload-hint">
      支持 JPG / PNG / PDF 等格式，上传后自动识别指标
    </p>
  </Dragger>
</Form.Item>
```

- [ ] **Step 6: Add OCR status bar**

After the upload Form.Item, before the indicator divider, insert:

```jsx
{ocrStatus !== 'idle' && (
  <Alert
    style={{ marginBottom: 16 }}
    type={
      ocrStatus === 'recognizing' ? 'info' :
      ocrStatus === 'success' ? 'success' : 'error'
    }
    showIcon
    icon={
      ocrStatus === 'recognizing' ? <LoadingOutlined spin /> :
      ocrStatus === 'success' ? <CheckCircleOutlined /> :
      <CloseCircleOutlined />
    }
    message={
      ocrStatus === 'recognizing' ? '正在识别报告内容...' :
      ocrStatus === 'success'
        ? `识别完成 — 共识别出指标`
        : `识别失败: ${ocrError}`
    }
    description={
      ocrStatus === 'success' ? (
        <Space size="small">
          <Button size="small" type="link" onClick={() => setShowRawText(!showRawText)}>
            {showRawText ? '隐藏原始文本' : '查看原始文本'}
          </Button>
          <Button size="small" type="link" icon={<RedoOutlined />}
            onClick={() => handleFileSelect(reportFile)}>
            重新识别
          </Button>
        </Space>
      ) : ocrStatus === 'error' ? (
        <Button size="small" type="link" onClick={() => handleFileSelect(reportFile)}>
          重试
        </Button>
      ) : null
    }
  />
)}
{showRawText && ocrRawText && (
  <pre style={{
    maxHeight: 200, overflow: 'auto', background: '#f5f5f5',
    padding: 12, borderRadius: 4, fontSize: 12, marginBottom: 16
  }}>
    {ocrRawText}
  </pre>
)}
```

- [ ] **Step 7: Update indicator section divider**

Replace lines 575-593 with:

```jsx
<Divider>
  <Space>
    <span>指标数据{indicatorData.length > 0 ? ` (${indicatorData.length} 项)` : ''}</span>
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={handleAddIndicator}
    >
      手动添加
    </Button>
  </Space>
</Divider>
```

- [ ] **Step 8: Update submit handler**

In `handleSubmit` (line 115), change:

```js
pdfFile: fileList.length > 0 ? fileList[0] : null
```

To:

```js
reportFile: reportFile
```

- [ ] **Step 9: Remove OCR modal**

Remove lines 641-646 (the `<OCRReportRecognition>` JSX at the bottom).

- [ ] **Step 10: Verify page renders**

```bash
cd client && npm start
```

Navigate to `/reports/upload` and verify no errors.

- [ ] **Step 11: Commit**

```bash
git add client/src/pages/Reports/ReportUpload.js
git commit -m "feat: rewrite ReportUpload with unified file upload + auto-OCR flow"
```

---

### Task 7: Frontend — Update ReportEdit.js

**Files:**
- Modify: `client/src/pages/Reports/ReportEdit.js`

The edit page currently has NO OCR functionality and NO file upload. Apply the same unified upload + auto-OCR pattern.

- [ ] **Step 1: Update imports**

Add to imports:

```js
import { Alert, Modal } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, RedoOutlined, InboxOutlined } from '@ant-design/icons';
import ocrAPI from '../../services/ocrAPI';
```

- [ ] **Step 2: Add state variables**

Add after existing state declarations:

```js
const [reportFile, setReportFile] = useState(null);
const [ocrStatus, setOcrStatus] = useState('idle');
const [ocrError, setOcrError] = useState(null);
const [ocrRawText, setOcrRawText] = useState('');
const [showRawText, setShowRawText] = useState(false);
```

- [ ] **Step 3: Add OCR functions**

Add the same `handleFileSelect`, `populateIndicatorsFromOCR`, and `handleCreateNewIndicator` functions from ReportUpload (Task 6, Step 3). Adjust for the edit page: use `updateReport` thunk instead of `createReport`.

- [ ] **Step 4: Add upload section to JSX**

Before the indicator table section, add the same unified upload Dragger + OCR status bar from ReportUpload.

Also show existing file info if `currentReport.filePath` is set:

```jsx
{currentReport.filePath && !reportFile && (
  <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
    <Space>
      <FileOutlined />
      <span>当前附件: {currentReport.fileName || '已上传文件'}</span>
      <Button size="small" type="link" danger onClick={() => {/* clear file logic */}}>
        移除
      </Button>
    </Space>
  </div>
)}
```

- [ ] **Step 5: Update submit handler**

Update the report data object to use `reportFile`:

```js
const reportData = {
  ...values,
  reportDate: values.reportDate.format('YYYY-MM-DD'),
  indicatorData: filteredIndicatorData,
  reportFile: reportFile
};
```

- [ ] **Step 6: Update indicator columns**

Apply the same match-status indicator columns from ReportUpload (Task 6, Step 4).

- [ ] **Step 7: Verify the edit page works**

Navigate to an existing report, click edit. Verify form loads and upload area is shown.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Reports/ReportEdit.js
git commit -m "feat: apply unified file upload + auto-OCR to ReportEdit page"
```

---

### Task 8: Frontend — Update ReportDetail.js

**Files:**
- Modify: `client/src/pages/Reports/ReportDetail.js`

- [ ] **Step 1: Replace pdfPath → filePath**

Global replace `pdfPath` with `filePath` and `fileName` references. Key locations:

- `currentReport?.pdfPath` → `currentReport?.filePath`
- Status text: `"PDF文件"` → `"报告附件"`
- Download button: update to use `/api/files/reports/${filename}` endpoint (already exists as authenticated file server)

For the download button, construct the URL from `filePath`:

```js
const handleDownload = () => {
  if (currentReport?.filePath) {
    const filename = currentReport.filePath.split('/').pop();
    const token = localStorage.getItem('token');
    window.open(`/api/files/reports/${filename}?token=${token}`, '_blank');
  }
};
```

Actually, the `/api/files/reports/:filename` endpoint uses header-based auth (`authenticateToken` middleware), not query param. For browser downloads, you need to either:
- Use a fetch with Authorization header and trigger download from blob, OR
- Add a temporary token-based query parameter support to the files route

Simplest approach: fetch with auth header and create a download link:

```js
const handleDownload = async () => {
  if (currentReport?.filePath) {
    const filename = currentReport.filePath.split('/').pop();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/files/reports/${filename}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentReport.fileName || filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      message.error('下载失败');
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Reports/ReportDetail.js
git commit -m "fix: update ReportDetail to use filePath with authenticated download"
```

---

### Task 9: Cleanup — Remove OCRReportRecognition.js

**Files:**
- Delete: `client/src/components/OCRReportRecognition.js`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "OCRReportRecognition" client/src/ --include="*.js" --include="*.jsx"
```

Expected: no results (references removed in Tasks 6 & 7).

- [ ] **Step 2: Delete the file**

```bash
rm client/src/components/OCRReportRecognition.js
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove OCRReportRecognition modal (absorbed into upload pages)"
```

---

### Task 10: End-to-End Testing

- [ ] **Step 1: Start the full application**

```bash
npm run dev
```

- [ ] **Step 2: Test image upload flow**

1. Navigate to report upload page
2. Upload a medical report image (JPG/PNG)
3. Verify OCR status bar shows "正在识别..."
4. Verify indicators populate the table
5. Verify matched indicators are normal, unmatched show "待确认" tag
6. Edit some values
7. Submit — verify report created with file attachment

- [ ] **Step 3: Test PDF upload flow**

1. Upload a text-based PDF
2. Verify text extraction works and indicators populate
3. Submit and verify

- [ ] **Step 4: Test edit flow**

1. Edit an existing report
2. Replace the file
3. Verify re-OCR triggers
4. Save changes

- [ ] **Step 5: Test manual entry flow**

1. Don't upload any file
2. Manually add indicators via "手动添加" button
3. Submit — should work without file

- [ ] **Step 6: Test delete flow**

1. Delete a report that has a file attachment
2. Verify the file is removed from `server/uploads/reports/`

- [ ] **Step 7: Test download flow**

1. View a report detail that has a file attachment
2. Click download — verify file downloads correctly
