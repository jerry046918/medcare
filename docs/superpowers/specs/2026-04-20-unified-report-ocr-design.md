# Unified Report Upload + OCR Design

## Problem

The current report upload and OCR features are disconnected. Users must manually click an "OCR Recognition" button, upload an image separately in a modal, confirm results, then import them into the report form. The PDF upload UI exists but is non-functional. This creates unnecessary friction.

## Solution

Merge file upload and OCR into a single unified flow: when the user selects a report attachment (image or PDF), OCR runs automatically and results populate the indicator table directly.

## Design Decisions

- **File types**: Images (JPG, PNG, GIF, BMP, WebP) + PDF
- **OCR trigger**: Silent automatic — starts immediately after file selection
- **Result display**: Fill indicator table directly, no confirmation modal
- **Multi-page PDF**: Auto-recognize all pages, merge results
- **Page layout**: Single-page inline (match existing layout)

## Frontend Changes

### ReportUpload.js — Restructured Upload Area

Replace the non-functional PDF upload area with a unified file upload zone:

1. **Basic info section** — unchanged (family member, date, hospital, doctor, notes)
2. **File upload zone** — drag-and-drop, accepts images + PDF (10MB max), shows file preview after selection
3. **OCR status bar** — new inline status indicator:
   - `uploading` → `recognizing` → `success` / `error`
   - Progress shows indeterminate spinner with "正在识别..." (no per-page progress — single HTTP request)
   - Success: green bar showing "识别出 N 个指标" with links to view raw text and re-recognize
   - Error: red bar with retry button and manual-entry fallback
4. **Indicator table** — unchanged structure, populated by OCR results

### OCR Result Handling — Indicator Table Population

OCR results are classified as matched or unmatched and populated into the indicator table:

- **Matched indicators**: Filled normally with indicatorId, value, unit, reference range, and auto-calculated status
- **Unmatched indicators**: Added as rows with value and unit, but with the indicator name field highlighted (yellow border). User can:
  - Search and select an existing indicator from the dropdown (same as current manual entry)
  - Click "新建指标" to create a new indicator inline — opens a small popover form (name, unit, reference range), saves to database, then links to the row
- A small badge next to each row shows match confidence: "已匹配" (green) or "待确认" (orange)

This replaces the removed OCRReportRecognition modal's matching/creation functionality.

### OCR vs Basic Info Field Interaction

OCR may extract metadata (hospital, date, doctor) in addition to indicators:

- **Rule**: OCR values do NOT overwrite fields the user has already filled in
- If basic info fields are empty when OCR completes, populate them from OCR results
- Show a subtle hint ("已从报告识别填入") next to auto-populated fields

### Removed Components

- Remove the standalone "OCR Recognition" button from ReportUpload.js
- Remove OCRReportRecognition.js modal (matching/creation logic moved inline into indicator table)
- OCR engine selection stays in Settings page (already exists)

### ReportEdit.js — Same Treatment

Apply identical file upload + auto-OCR changes to the edit page. Replacing a file triggers re-OCR.

### State Management

New `ocrStatus` state in ReportUpload/ReportEdit:
- `idle` — no file uploaded yet
- `uploading` — file being sent to server
- `recognizing` — OCR in progress (indeterminate spinner)
- `success` — results available, indicators populated
- `error` — recognition failed, show error message

Re-uploading a file clears previous OCR results and re-runs recognition.

## Backend Changes

### PDF Processing — ocrService.js

Add PDF-to-image conversion using `pdfjs-dist` (pure JavaScript, no native binary dependencies):
- Convert each PDF page to a PNG image buffer using pdfjs-dist
- Run OCR on each page image independently
- Merge results across pages, deduplicating by indicator name (keep last occurrence)
- Add `processPDF` method alongside existing `processImage` method
- pdfjs-dist is preferred over pdf-poppler to avoid requiring system-level Poppler installation (important for Windows and Docker)

### API Changes

**Extended endpoint:**
- `POST /api/ocr/recognize-and-parse` — extend to accept PDF files, auto-detect format by file extension/mime type. Frontend sends file using form field name `image` (matching existing multer config). When a PDF is detected, route through `processPDF` instead of `processImage`.

**File lifecycle**: The OCR endpoint stores a temporary file, processes it, then deletes the temp copy (existing behavior). This is separate from the report submission — the file is uploaded again when submitting the report via `POST /api/reports`.

**Modified endpoints:**
- `POST /api/reports` — switch to `multipart/form-data`:
  - Add `upload.single('file')` multer middleware
  - Save file to `server/uploads/reports/`
  - Parse `indicatorData` from `JSON.parse(req.body.indicatorData)`
  - Store file path and original name in report record
- `PUT /api/reports/:id` — same changes:
  - Add multer middleware, handle optional file replacement
  - If new file uploaded: delete old file, save new file
  - Parse indicatorData from stringified JSON

**Frontend form field**: Frontend sends OCR request with field name `image`, report submission with field name `file`.

### Database Changes

Rename existing `pdfPath` column to `filePath` and add `fileName`:
- `filePath` (STRING, nullable) — relative path to uploaded file (replaces `pdfPath`)
- `fileName` (STRING, nullable) — original file name for display/download

Migration script: `scripts/updateReportFileFields.js`:
- Rename `pdfPath` column to `filePath`
- Add `fileName` column (nullable)
- Create `server/uploads/reports/` directory if it doesn't exist
- Update any code referencing `pdfPath` (ReportDetail.js, report routes)

### File Cleanup

- **Report deletion** (`DELETE /api/reports/:id`): Also delete the file at `report.filePath` from disk
- **Report update with file replacement**: Delete old file before saving new one

### Indicator Deduplication

Current backend dedup keeps first occurrence per indicatorId. Align with spec:
- Frontend deduplicates OCR results before submission (keep last occurrence for multi-page PDF)
- Backend dedup behavior unchanged (keep first occurrence — acts as safety net)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| OCR engine unavailable | Show error, suggest configuring in Settings, table still editable manually |
| File too large / wrong format | Frontend validation before upload, immediate feedback |
| PDF conversion fails | Show "PDF 处理失败，请尝试上传截图", file still saved as attachment on submit |
| Partial indicator recognition | Recognized indicators fill table, unmatched shown with "待确认" badge |
| Network error during OCR | Show retry button, preserve any already-entered manual data |

## User Flow (End-to-End)

1. User navigates to report upload page
2. Fills in basic info (optional — can do after OCR)
3. Drags or selects a report file (image or PDF)
4. File uploads to OCR endpoint, status bar shows "正在识别..."
5. OCR completes → status bar turns green: "识别出 12 个指标，已自动填入下方表格"
6. Matched indicators populate the table with values, units, reference ranges, and status
7. Unmatched indicators appear with "待确认" badge — user can match or create new indicators inline
8. If basic info fields were empty, OCR-extracted metadata auto-fills them
9. User reviews, edits, adds/removes indicators as needed
10. User clicks submit → file uploaded again with report form data, report created

## Files to Modify

- `client/src/pages/Reports/ReportUpload.js` — restructure upload area, inline OCR logic, add indicator matching/creation inline
- `client/src/pages/Reports/ReportEdit.js` — same changes
- `client/src/pages/Reports/ReportDetail.js` — update pdfPath references to filePath
- `client/src/components/OCRReportRecognition.js` — remove
- `client/src/services/reportAPI.js` — update `create` and `update` methods to use FormData with file field
- `client/src/store/slices/reportSlice.js` — update thunks for file upload support
- `server/services/ocrService.js` — add PDF processing via pdfjs-dist
- `server/routes/ocr.js` — extend recognize-and-parse to handle PDF format
- `server/routes/reports.js` — add multer middleware to POST/PUT, add file cleanup on DELETE/PUT
- `server/models/MedicalReport.js` — rename pdfPath to filePath, add fileName
- `server/scripts/updateReportFileFields.js` — new migration script
- `package.json` — add pdfjs-dist dependency
