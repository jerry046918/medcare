import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import familyMemberSlice from './slices/familyMemberSlice';
import reportSlice from './slices/reportSlice';
import indicatorSlice from './slices/indicatorSlice';
import medicationSlice from './slices/medicationSlice';
import medicalLogSlice from './slices/medicalLogSlice';
export const store = configureStore({
  reducer: {
    auth: authSlice,
    familyMembers: familyMemberSlice,
    reports: reportSlice,
    indicators: indicatorSlice,
    medications: medicationSlice,
    medicalLogs: medicalLogSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

/** @typedef {ReturnType<typeof store.getState>} RootState */
/** @typedef {typeof store.dispatch} AppDispatch */
