import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import medicationAPI from '../../services/medicationAPI';

// 获取指定成员的用药记录
export const fetchMedications = createAsyncThunk(
  'medications/fetchByMember',
  async (memberId, { rejectWithValue }) => {
    try {
      const response = await medicationAPI.getByMember(memberId);
      return response.data.data || [];
    } catch (error) {
      return rejectWithValue(error.userMessage || '获取用药记录失败');
    }
  }
);

// 创建用药记录
export const createMedication = createAsyncThunk(
  'medications/create',
  async (data, { rejectWithValue }) => {
    try {
      const response = await medicationAPI.create(data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.userMessage || '创建用药记录失败');
    }
  }
);

// 更新用药记录
export const updateMedication = createAsyncThunk(
  'medications/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await medicationAPI.update(id, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.userMessage || '更新用药记录失败');
    }
  }
);

// 删除用药记录
export const deleteMedication = createAsyncThunk(
  'medications/delete',
  async (id, { rejectWithValue }) => {
    try {
      await medicationAPI.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.userMessage || '删除用药记录失败');
    }
  }
);

const medicationSlice = createSlice({
  name: 'medications',
  initialState: {
    list: [],
    currentMedication: null,
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
    clearCurrentMedication: (state) => {
      state.currentMedication = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchMedications
      .addCase(fetchMedications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMedications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchMedications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // createMedication
      .addCase(createMedication.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createMedication.fulfilled, (state, action) => {
        state.isCreating = false;
        state.list.unshift(action.payload);
      })
      .addCase(createMedication.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      })
      // updateMedication
      .addCase(updateMedication.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateMedication.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.list.findIndex(med => med.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        if (state.currentMedication && state.currentMedication.id === action.payload.id) {
          state.currentMedication = action.payload;
        }
      })
      .addCase(updateMedication.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      })
      // deleteMedication
      .addCase(deleteMedication.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteMedication.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.list = state.list.filter(med => med.id !== action.payload);
        if (state.currentMedication && state.currentMedication.id === action.payload) {
          state.currentMedication = null;
        }
      })
      .addCase(deleteMedication.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearCurrentMedication } = medicationSlice.actions;
export default medicationSlice.reducer;
