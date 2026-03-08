# MEDCARE - Family Health Management System

**Generated:** 2026-03-09 (updated)
**Stack:** React 18 + Redux Toolkit + Express + SQLite + PaddleOCR

## OVERVIEW

Full-stack family health management application with OCR report recognition. Features member management, medical reports, health indicators tracking, medications, hospital records, and intelligent report parsing via PaddleOCR.

## ENTRY POINTS

| Location | Command | Port |
|----------|---------|------|
| Full stack | `npm run dev` | 3000 + 3001 |
| Frontend only | `npm run client` | 3000 |
| Backend only | `npm run server` | 3001 |
| Server entry | `server/index.js` | - |

## STRUCTURE

```
medcare/
├── package.json           # Root orchestration scripts
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Container orchestration
├── client/                # React frontend (see ./client/AGENTS.md)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API clients (10 files)
│   │   ├── store/         # Redux slices (6 slices)
│   │   └── styles/        # CSS
│   └── package.json
├── server/                # Express backend (see ./server/AGENTS.md)
│   ├── index.js           # Entry point
│   ├── middleware/        # Auth, error handling
│   ├── models/            # Sequelize models
│   ├── routes/            # API routes (9 files)
│   ├── services/          # Business logic + OCR
│   ├── scripts/           # DB init scripts
│   ├── python311/         # Python env (GITIGNORE!)
│   └── package.json
└── README.md
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Start dev | `npm run dev` (root) |
| Add API endpoint | `server/routes/*.js` |
| Add DB model | `server/models/*.js` |
| Add Redux state | `client/src/store/*.js` |
| Add page | `client/src/pages/*.js` |
| Add component | `client/src/components/*.js` |
| API client | `client/src/services/*.js` |
| Auth logic | `server/middleware/auth.js` |

## COMMANDS

```bash
# Development (both)
npm run dev

# Frontend only
npm run client    # or: cd client && npm start

# Backend only
npm run server    # or: cd server && npm run dev

# Build frontend
npm run build

# Initialize database
npm run init-db

# Install all deps
npm run install-all
```

## API ENDPOINTS

### Auth
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify JWT
- `GET /api/auth/init-status` - Check initialization

### Family Members
- `GET|POST|PUT|DELETE /api/family-members[/id]`

### Medical Reports
- `GET|POST|PUT|DELETE /api/reports[/id]`

### Health Indicators
- `GET|POST|PUT|DELETE /api/indicators[/id]`

## DATABASE

SQLite via Sequelize ORM:
- `Users` - Authentication
- `FamilyMembers` - Member profiles
- `MedicalReports` - Report metadata + PDF path
- `MedicalIndicators` - Indicator definitions (26 defaults)
- `ReportIndicatorData` - Parsed indicator values
- `Medications` - Medication records
- `MedicalLogs` - Health event logs
- `Hospitals` - Hospital autocomplete data

## CONVENTIONS

### Frontend (client/)
- React 18 + Redux Toolkit
- UI: Ant Design
- Charts: ECharts
- Dates: dayjs
- HTTP: Axios
- Structure: CRA standard (src/components, src/pages, etc.)

### Backend (server/)
- Express.js
- ORM: Sequelize
- Auth: JWT (bcrypt for passwords)
- File upload: Multer
- Dev: nodemon

## ANTI-PATTERNS

- **DO NOT** use npm workspaces - project uses `cd`-based scripts
- **DO NOT** commit `server/uploads/` - add to .gitignore
- **DO NOT** commit `server/database/*.sqlite` - local DB only
- **DO NOT** commit `server/python311/` - Python env (~100MB)
- **DO NOT** commit `server/paddleocr_models/` - ML models
- **DO NOT** hardcode JWT secret - use env vars (CRITICAL)
- **DO NOT** leave debug console.log in production code
- **AVOID** deeply nested routes - keep flat in `server/routes/`
- **AVOID** mixing npm and yarn - project uses npm

## SECURITY CONCERNS

- **Hardcoded JWT fallback**: `medcare_family_system_secret_key` in auth.js - REMOVE
- **Token in localStorage**: XSS vulnerable - consider httpOnly cookies
- **Missing .gitignore**: Create at root with proper exclusions
- **Default credentials**: admin/123456 created on init - enforce change

## OCR INTEGRATION

Python-based OCR via PaddleOCR:
```bash
# OCR is enabled by default in Docker
PADDLE_OCR_ENABLED=true
PYTHON_CMD=python3

# Models auto-download to paddleocr_models/
```

- OCR service: `server/services/ocrService.js`
- Python worker: `server/services/paddle_ocr_worker.py`
- Parser service: `server/services/indicatorParserService.js`

## ENVIRONMENT

Server `.env`:
```
NODE_ENV=production
PORT=3001
JWT_SECRET=<strong-random-key>  # REQUIRED - no fallback!
JWT_EXPIRES_IN=7d
PADDLE_OCR_ENABLED=true
```

Client `.env`:
```
REACT_APP_API_URL=/api
```
