# MEDCARE SERVER

**Generated:** 2026-03-09 (updated)
**Stack:** Express.js + Sequelize + SQLite + PaddleOCR

## OVERVIEW

REST API backend for family health management. JWT authentication, file uploads, OCR integration, health data CRUD.

## ENTRY POINT

- `index.js` - Server startup, middleware setup, routes
- Dev: `npm run dev` (nodemon, port 3001)
- Prod: `npm start`

## STRUCTURE

```
server/
├── index.js            # Entry point, Express setup
├── middleware/         # Custom middleware
│   └── auth.js         # JWT verification
├── models/             # Sequelize models
│   ├── index.js        # Model associations
│   ├── User.js
│   ├── FamilyMember.js
│   ├── MedicalReport.js
│   ├── MedicalIndicator.js
│   ├── Medication.js
│   ├── MedicalLog.js
│   └── Hospital.js
├── routes/             # API routes (9 files)
│   ├── auth.js
│   ├── familyMembers.js
│   ├── reports.js
│   ├── indicators.js
│   ├── medications.js
│   ├── medicalLogs.js
│   ├── hospitals.js
│   ├── ocr.js
│   └── config.js
├── services/           # Business logic
│   ├── ocrService.js   # OCR orchestration
│   ├── indicatorParserService.js
│   └── paddle_ocr_worker.py
├── scripts/
│   └── initDatabase.js # DB initialization
├── python311/          # Python env (GITIGNORE! ~100MB)
├── paddleocr_models/   # ML models (GITIGNORE!)
├── database/           # SQLite files (gitignored)
└── uploads/            # File uploads (gitignored)
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add route | `routes/*.js` |
| Add model | `models/NewModel.js` + register in `models/index.js` |
| Add middleware | `middleware/*.js` |
| Auth logic | `middleware/auth.js`, `routes/auth.js` |
| DB init | `scripts/initDatabase.js` |
| Express config | `index.js` |
| OCR integration | `services/ocrService.js`, `services/paddle_ocr_worker.py` |
| Indicator parsing | `services/indicatorParserService.js` |

## COMMANDS

```bash
npm run dev      # Dev with nodemon
npm start        # Production
npm run init-db  # Initialize database
```

## API STRUCTURE

All routes prefixed with `/api`:
- `/api/auth/*` - Authentication
- `/api/family-members/*` - CRUD
- `/api/reports/*` - CRUD + file upload
- `/api/indicators/*` - CRUD
- `/api/medications/*` - CRUD
- `/api/medical-logs/*` - CRUD
- `/api/hospitals/*` - Autocomplete
- `/api/ocr/*` - OCR processing
- `/api/config/*` - Configuration
- `/api/health` - Health check
## CONVENTIONS

- **ORM**: Sequelize with SQLite
- **Auth**: JWT in Authorization header
- **Passwords**: bcrypt hashing
- **Files**: Multer to `uploads/`
- **Errors**: JSON with `{ error: message }`

## MODEL RELATIONSHIPS

```
User (1) ─── (N) FamilyMember
FamilyMember (1) ─── (N) MedicalReport
FamilyMember (1) ─── (N) Medication
FamilyMember (1) ─── (N) MedicalLog
MedicalReport (1) ─── (N) ReportIndicatorData
MedicalIndicator (1) ─── (N) ReportIndicatorData
```

## ANTI-PATTERNS

- **DO NOT** commit `*.sqlite` files
- **DO NOT** commit `uploads/` directory
- **DO NOT** commit `python311/` directory (~100MB)
- **DO NOT** commit `paddleocr_models/` directory
- **DO NOT** hardcode JWT secret - use env vars
- **DO NOT** leave debug console.log in production
- **AVOID** raw SQL - use Sequelize methods

## SECURITY WARNING

- **CRITICAL**: Hardcoded JWT fallback `medcare_family_system_secret_key`
- **REMOVE**: This fallback in `middleware/auth.js` and `routes/auth.js`
- **REQUIRED**: Set `JWT_SECRET` environment variable

## OCR INTEGRATION

PaddleOCR runs via Python subprocess:
- Environment: `PADDLE_OCR_ENABLED=true`
- Python command: `PYTHON_CMD=python3`
- Worker script: `services/paddle_ocr_worker.py`
- Models cached in: `paddleocr_models/`
