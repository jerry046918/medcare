import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import reportAPI from '../../services/reportAPI';

// 异步thunk：获取所有报告
export const fetchReports = createAsyncThunk(
  'reports/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await reportAPI.getAll();
      return response.data.data || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '获取报告失败');
    }
  }
);

// 异步thunk：获取单个报告详情
export const fetchReportDetail = createAsyncThunk(
  'reports/fetchDetail',
  async (id, { rejectWithValue }) => {
    try {
      const response = await reportAPI.getById(id);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '获取报告详情失败');
    }
  }
);

// 异步thunk：创建报告
export const createReport = createAsyncThunk(
  'reports/create',
  async (reportData, { rejectWithValue }) => {
    try {
      const response = await reportAPI.create(reportData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '创建报告失败');
    }
  }
);

// 异步thunk：更新报告
export const updateReport = createAsyncThunk(
  'reports/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await reportAPI.update(id, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '更新报告失败');
    }
  }
);

// 异步thunk：删除报告
export const deleteReport = createAsyncThunk(
  'reports/delete',
  async (id, { rejectWithValue }) => {
    try {
      await reportAPI.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '删除报告失败');
    }
  }
);

const reportSlice = createSlice({
  name: 'reports',
  initialState: {
    list: [],
    currentReport: null,
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
    clearCurrentReport: (state) => {
      state.currentReport = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchReports
      .addCase(fetchReports.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // fetchReportDetail
      .addCase(fetchReportDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReportDetail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentReport = action.payload;
      })
      .addCase(fetchReportDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // createReport
      .addCase(createReport.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createReport.fulfilled, (state, action) => {
        state.isCreating = false;
        state.list.unshift(action.payload);
      })
      .addCase(createReport.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      })
      // updateReport
      .addCase(updateReport.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateReport.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.list.findIndex(report => report.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        if (state.currentReport && state.currentReport.id === action.payload.id) {
          state.currentReport = { ...state.currentReport, ...action.payload };
        }
      })
      .addCase(updateReport.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      })
      // deleteReport
      .addCase(deleteReport.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteReport.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.list = state.list.filter(report => report.id !== action.payload);
        if (state.currentReport && state.currentReport.id === action.payload) {
          state.currentReport = null;
        }
      })
      .addCase(deleteReport.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearCurrentReport } = reportSlice.actions;
export default reportSlice.reducer;