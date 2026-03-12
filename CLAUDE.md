# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedCare is a full-stack family health management system built with React + Node.js + SQLite. It helps families manage health information, medical reports, and health indicators.

## Common Commands

### Development
```bash
# Install all dependencies (root, server, client)
npm run install-all

# Start both frontend and backend in development mode
npm run dev

# Start backend only (port 3001)
npm run server

# Start frontend only (port 3000)
npm run client

# Initialize/reset database
npm run init-db
# Or from server directory:
cd server && npm run init-db
```

### Production Build
```bash
# Build frontend for production
npm run build
# Output goes to client/build/, then copy to server/public/ for serving

# Start production server
cd server && npm start
```

### Docker
```bash
docker-compose up -d
```

## Architecture

### Backend (server/)
- **Express.js** server on port 3001
- **Sequelize ORM** with **SQLite** database at `server/database/medcare.db`
- **JWT authentication** via middleware (`middleware/auth.js`)

**Key directories:**
- `models/` - Sequelize models with relationships defined in `models/index.js`
- `routes/` - Express route handlers for each resource
- `services/` - Business logic including OCR service
- `middleware/` - Auth middleware and rate limiter
- `scripts/` - Database initialization and migration scripts
- `utils/` - Utility functions
- `config/` - Configuration files

**Data model relationships:**
- User → hasMany FamilyMembers
- FamilyMember → hasMany MedicalReports, Medications, MedicalLogs
- MedicalReport → hasMany ReportIndicatorData
- MedicalIndicator → hasMany ReportIndicatorData

### Frontend (client/)
- **React 18** with **Redux Toolkit** for state management
- **Ant Design** for UI components
- **React Router** for routing, **ECharts** for charts
- Proxy configured to backend at `http://localhost:3001`

**Key directories:**
- `src/pages/` - Route-level page components (Auth, Dashboard, FamilyMembers, Reports, Settings)
- `src/components/` - Reusable components (Layout, OCRReportRecognition, HospitalAutoComplete)
- `src/services/` - API service modules using axios
- `src/store/slices/` - Redux slices for each domain (auth, familyMembers, reports, indicators, medications, medicalLogs)
- `src/utils/` - Utility functions

**Note:** Health indicators are managed within the Settings page (`/settings`), not as a separate route.

### OCR Service
Located at `server/services/ocrService.js`. Supports multiple OCR engines:
- **PaddleOCR** (default, local Python) - uses embedded Python 3.11 at `server/python311/`
- **OpenAI Vision** - requires API key configuration
- **Baidu OCR** - requires API key/secret
- **Tencent OCR** - requires secret ID/key

OCR configuration is stored in SystemConfig table and managed via `/api/ocr` routes.

## Health Indicator Reference Ranges

The system supports flexible reference ranges for health indicators:

1. **Single boundary ranges**: Indicators can have only min (≥), only max (≤), or both
2. **Gender-specific ranges**: Optional female-specific ranges (normalMinFemale, normalMaxFemale)
3. **Automatic judgment**: When saving report data, the system automatically:
   - Gets the family member's gender
   - Selects appropriate reference range (female-specific if available and member is female)
   - Determines if the value is normal, high, or low

**Example indicators with gender-specific ranges:**
- Uric acid: Male 208-428 μmol/L, Female 155-357 μmol/L
- Hemoglobin: Male 120-160 g/L, Female 110-150 g/L

## Environment Variables

Server (`server/.env`):
```
NODE_ENV=production
PORT=3001
JWT_SECRET=<strong-random-key>
JWT_EXPIRES_IN=7d
PADDLE_OCR_ENABLED=true
PYTHON_CMD=python3
```

Client (`client/.env`):
```
REACT_APP_API_URL=/api
```

## Database Management

- Database file: `server/database/medcare.db` (SQLite)
- Initialization: `node server/scripts/initDatabase.js`
- Reset: `node server/scripts/resetDatabase.js`
- Schema migration: `node server/scripts/updateIndicatorSchema.js`
- Default indicators are seeded from `server/scripts/defaultIndicators.js`

## Authentication Flow

1. On first use, system checks `/api/auth/init-status` for setup status
2. If no users exist, redirects to registration
3. JWT tokens are stored in localStorage, verified via `/api/auth/verify`
4. Auth middleware (`middleware/auth.js`) validates JWT on protected routes

## API Structure

All API routes are prefixed with `/api/`:
- `/api/auth/*` - Authentication (register, login, verify, init-status)
- `/api/family-members/*` - Family member CRUD
- `/api/reports/*` - Medical reports with file uploads (multer)
- `/api/indicators/*` - Medical indicator definitions (supports gender-specific ranges)
- `/api/medications/*` - Medication tracking
- `/api/medical-logs/*` - Medical event logs
- `/api/hospitals/*` - Hospital data/autocomplete
- `/api/ocr/*` - OCR recognition and configuration
- `/api/config/*` - System configuration
