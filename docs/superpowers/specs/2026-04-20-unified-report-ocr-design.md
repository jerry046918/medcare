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
   - `uploading` → `recognizing` (with page progress for PDFs) → `success` / `error`
   - Success: green bar showing "识别出 N 个指标" with links to view raw text and re-recognize
   - Error: red bar with retry button and manual-entry fallback
4. **Indicator table** — unchanged structure, populated by OCR results

### Removed Components

- Remove the standalone "OCR Recognition" button from ReportUpload.js
- Remove OCRReportRecognition.js modal (its logic moves inline into the upload flow)
- OCR engine selection stays in Settings page (already exists)

### ReportEdit.js — Same Treatment

Apply identical file upload + auto-OCR changes to the edit page. Replacing a file triggers re-OCR.

### State Management

New `ocrStatus` state in ReportUpload/ReportEdit:
- `idle` — no file uploaded yet
- `uploading` — file being sent to server
- `recognizing` — OCR in progress (show page progress for multi-page PDFs)
- `success` — results available, indicators populated
- `error` — recognition failed, show error message

Re-uploading a file clears previous OCR results and re-runs recognition.

## Backend Changes

### PDF Processing — ocrService.js

Add PDF-to-image conversion using `pdf-poppler`:
- Convert each PDF page to a PNG image
- Run OCR on each page image independently
- Merge results across pages, deduplicating by indicator name (keep last occurrence)
- Add `processPDF` method alongside existing `processImage` method

### API Changes

**Existing endpoint used as-is:**
- `POST /api/ocr/recognize-and-parse` — accepts file upload, runs OCR, returns structured indicators. Extend to accept PDF files and auto-detect format.

**Modified endpoints:**
- `POST /api/reports` — accept file attachment via multer, save to `server/uploads/reports/`, store path in report record
- `PUT /api/reports/:id` — same file attachment support, handle file replacement

### Database Changes

Add two nullable columns to the Reports table:
- `filePath` (STRING) — relative path to uploaded file
- `fileName` (STRING) — original file name for display/download

Migration script: `scripts/updateReportFileFields.js` — adds columns with NULL allowed for backward compatibility.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| OCR engine unavailable | Show error, suggest configuring in Settings, table still editable manually |
| File too large / wrong format | Frontend validation before upload, immediate feedback |
| PDF conversion fails | Show "PDF 处理失败，请尝试上传截图", file still saved as attachment |
| Partial indicator recognition | Recognized indicators fill table, raw OCR text available for manual review |
| Network error during OCR | Show retry button, preserve any already-entered manual data |

## User Flow (End-to-End)

1. User navigates to report upload page
2. Fills in basic info (optional — can do after OCR)
3. Drags or selects a report file (image or PDF)
4. File uploads, OCR status bar shows "正在识别..."
5. For multi-page PDF: shows "正在识别第 1/N 页..."
6. OCR completes → status bar turns green: "识别出 12 个指标，已自动填入下方表格"
7. Indicators populate the table with values, units, reference ranges, and normal/abnormal status
8. User reviews, edits, adds/removes indicators as needed
9. User clicks submit → report created with file attachment and indicator data

## Files to Modify

- `client/src/pages/Reports/ReportUpload.js` — restructure upload area, inline OCR logic
- `client/src/pages/Reports/ReportEdit.js` — same changes
- `client/src/components/OCRReportRecognition.js` — remove (logic absorbed into upload pages)
- `server/services/ocrService.js` — add PDF processing
- `server/routes/ocr.js` — extend recognize-and-parse to handle PDF
- `server/routes/reports.js` — add file upload support to POST and PUT
- `server/models/` — update Report model with filePath, fileName
- `server/scripts/updateReportFileFields.js` — new migration script
