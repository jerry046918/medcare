import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import indicatorAPI from '../../services/indicatorAPI';

// 异步thunk：获取所有指标
export const fetchIndicators = createAsyncThunk(
  'indicators/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await indicatorAPI.getAll();
      return response.data.data || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '获取指标失败');
    }
  }
);

// 异步thunk：获取单个指标详情
export const fetchIndicatorDetail = createAsyncThunk(
  'indicators/fetchDetail',
  async (id, { rejectWithValue }) => {
    try {
      const response = await indicatorAPI.getById(id);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '获取指标详情失败');
    }
  }
);

// 异步thunk：创建指标
export const createIndicator = createAsyncThunk(
  'indicators/create',
  async (indicatorData, { rejectWithValue }) => {
    try {
      const response = await indicatorAPI.create(indicatorData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '创建指标失败');
    }
  }
);

// 异步thunk：更新指标
export const updateIndicator = createAsyncThunk(
  'indicators/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await indicatorAPI.update(id, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '更新指标失败');
    }
  }
);

// 异步thunk：删除指标
export const deleteIndicator = createAsyncThunk(
  'indicators/delete',
  async (id, { rejectWithValue }) => {
    try {
      await indicatorAPI.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '删除指标失败');
    }
  }
);

const indicatorSlice = createSlice({
  name: 'indicators',
  initialState: {
    list: [],
    currentIndicator: null,
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
    clearCurrentIndicator: (state) => {
      state.currentIndicator = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchIndicators
      .addCase(fetchIndicators.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchIndicators.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchIndicators.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // fetchIndicatorDetail
      .addCase(fetchIndicatorDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchIndicatorDetail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentIndicator = action.payload;
      })
      .addCase(fetchIndicatorDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // createIndicator
      .addCase(createIndicator.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createIndicator.fulfilled, (state, action) => {
        state.isCreating = false;
        state.list.unshift(action.payload);
      })
      .addCase(createIndicator.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      })
      // updateIndicator
      .addCase(updateIndicator.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateIndicator.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.list.findIndex(indicator => indicator.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        if (state.currentIndicator && state.currentIndicator.id === action.payload.id) {
          state.currentIndicator = { ...state.currentIndicator, ...action.payload };
        }
      })
      .addCase(updateIndicator.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      })
      // deleteIndicator
      .addCase(deleteIndicator.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteIndicator.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.list = state.list.filter(indicator => indicator.id !== action.payload);
        if (state.currentIndicator && state.currentIndicator.id === action.payload) {
          state.currentIndicator = null;
        }
      })
      .addCase(deleteIndicator.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearCurrentIndicator } = indicatorSlice.actions;
export default indicatorSlice.reducer;