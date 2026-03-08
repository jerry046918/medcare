# MEDCARE CLIENT

**Generated:** 2026-03-09 (updated)
**Stack:** React 18 + Redux Toolkit + Ant Design + ECharts

## OVERVIEW

React frontend for family health management. Features dashboard, member profiles, medical reports, health charts, OCR report recognition.

## ENTRY POINT

- `src/index.js` → `src/App.js`
- Dev: `npm start` (port 3000)
- Build: `npm run build` → `build/`
```
client/src/
├── index.js           # Entry point
├── App.js             # Root component + routing
├── components/        # Reusable components
│   ├── common/        # Shared components (HospitalAutoComplete)
│   └── Layout/        # MainLayout
├── pages/             # Page components
│   ├── Dashboard/     # Main dashboard
│   ├── FamilyMembers/ # Member management
│   ├── Reports/       # Medical reports (list, upload, detail, edit)
│   ├── Indicators/    # Health indicators
│   ├── Settings/      # Settings + OCR settings
│   └── Auth/          # Login, Register
├── services/          # API clients (10 files)
│   ├── api.js         # Axios instance + interceptors
│   ├── authAPI.js     # Authentication
│   ├── familyMemberAPI.js
│   ├── reportAPI.js
│   ├── indicatorAPI.js
│   ├── medicationAPI.js
│   ├── medicalLogAPI.js
│   ├── hospitalAPI.js
│   └── ocrAPI.js
├── store/             # Redux Toolkit slices (6 slices)
│   ├── index.js       # Store configuration
│   └── slices/
│       ├── authSlice.js
│       ├── familyMemberSlice.js
│       ├── reportSlice.js
│       ├── indicatorSlice.js
│       ├── medicationSlice.js
│       └── medicalLogSlice.js
└── styles/            # CSS files
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add route | `src/App.js` |
| Add page | `src/pages/NewPage/` |
| Add component | `src/components/ComponentName.js` |
| Add API call | `src/services/api.js` |
| Add Redux state | `src/store/slices/featureSlice.js` |
| Configure store | `src/store/index.js` |

## COMMANDS

```bash
npm start       # Dev server (port 3000)
npm run build   # Production build
npm test        # Run tests
```

## CONVENTIONS

- **State**: Redux Toolkit with slices pattern
- **UI**: Ant Design components
- **Charts**: ECharts for data visualization
- **HTTP**: Axios with base URL configuration
- **Routing**: React Router v6
- **Dates**: dayjs (not moment)
- **Auth**: JWT in localStorage (consider httpOnly cookies)

## ANTI-PATTERNS

- **DO NOT** import from `../../..` - use clear relative paths
- **DO NOT** store API URLs in components - use services/
- **AVOID** prop drilling - use Redux for shared state
- **DO NOT** leave debug console.log in production code

## SECURITY NOTE

- Token stored in localStorage is XSS vulnerable
- Consider migrating to httpOnly cookies for better security
