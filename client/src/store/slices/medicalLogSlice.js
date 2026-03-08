import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import medicalLogAPI from '../../services/medicalLogAPI';

// 获取指定成员的医疗日志
export const fetchMedicalLogs = createAsyncThunk(
  'medicalLogs/fetchByMember',
  async (memberId, { rejectWithValue }) => {
    try {
      const response = await medicalLogAPI.getByMember(memberId);
      return response.data.data || [];
    } catch (error) {
      return rejectWithValue(error.userMessage || '获取医疗日志失败');
    }
  }
);

// 创建医疗日志
export const createMedicalLog = createAsyncThunk(
  'medicalLogs/create',
  async (data, { rejectWithValue }) => {
    try {
      const response = await medicalLogAPI.create(data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.userMessage || '创建医疗日志失败');
    }
  }
);

// 更新医疗日志
export const updateMedicalLog = createAsyncThunk(
  'medicalLogs/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await medicalLogAPI.update(id, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.userMessage || '更新医疗日志失败');
    }
  }
);

// 删除医疗日志
export const deleteMedicalLog = createAsyncThunk(
  'medicalLogs/delete',
  async (id, { rejectWithValue }) => {
    try {
      await medicalLogAPI.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.userMessage || '删除医疗日志失败');
    }
  }
);

const medicalLogSlice = createSlice({
  name: 'medicalLogs',
  initialState: {
    list: [],
    currentLog: null,
    isLoading: false,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentLog: (state) => {
      state.currentLog = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchMedicalLogs
      .addCase(fetchMedicalLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMedicalLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchMedicalLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // createMedicalLog
      .addCase(createMedicalLog.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createMedicalLog.fulfilled, (state, action) => {
        state.isCreating = false;
        state.list.unshift(action.payload);
      })
      .addCase(createMedicalLog.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      })
      // updateMedicalLog
      .addCase(updateMedicalLog.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateMedicalLog.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.list.findIndex(log => log.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        if (state.currentLog && state.currentLog.id === action.payload.id) {
          state.currentLog = action.payload;
        }
      })
      .addCase(updateMedicalLog.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      })
      // deleteMedicalLog
      .addCase(deleteMedicalLog.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteMedicalLog.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.list = state.list.filter(log => log.id !== action.payload);
        if (state.currentLog && state.currentLog.id === action.payload) {
          state.currentLog = null;
        }
      })
      .addCase(deleteMedicalLog.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearCurrentLog } = medicalLogSlice.actions;
export default medicalLogSlice.reducer;
