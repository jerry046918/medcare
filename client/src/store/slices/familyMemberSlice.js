import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import familyMemberAPI from '../../services/familyMemberAPI';

// 异步thunk：获取所有家庭成员
export const fetchFamilyMembers = createAsyncThunk(
  'familyMembers/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await familyMemberAPI.getAll();
      return response.data.data || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '获取家庭成员失败');
    }
  }
);

// 异步thunk：获取单个家庭成员详情
export const fetchFamilyMemberDetail = createAsyncThunk(
  'familyMembers/fetchDetail',
  async (id, { rejectWithValue }) => {
    try {
      const response = await familyMemberAPI.getById(id);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '获取家庭成员详情失败');
    }
  }
);

// 异步thunk：创建家庭成员
export const createFamilyMember = createAsyncThunk(
  'familyMembers/create',
  async (memberData, { rejectWithValue }) => {
    try {
      const response = await familyMemberAPI.create(memberData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '创建家庭成员失败');
    }
  }
);

// 异步thunk：更新家庭成员
export const updateFamilyMember = createAsyncThunk(
  'familyMembers/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await familyMemberAPI.update(id, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '更新家庭成员失败');
    }
  }
);

// 异步thunk：删除家庭成员
export const deleteFamilyMember = createAsyncThunk(
  'familyMembers/delete',
  async (id, { rejectWithValue }) => {
    try {
      await familyMemberAPI.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '删除家庭成员失败');
    }
  }
);

const familyMemberSlice = createSlice({
  name: 'familyMembers',
  initialState: {
    list: [],
    currentMember: null,
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
    clearCurrentMember: (state) => {
      state.currentMember = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchFamilyMembers
      .addCase(fetchFamilyMembers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFamilyMembers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchFamilyMembers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // fetchFamilyMemberDetail
      .addCase(fetchFamilyMemberDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFamilyMemberDetail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentMember = action.payload;
      })
      .addCase(fetchFamilyMemberDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // createFamilyMember
      .addCase(createFamilyMember.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createFamilyMember.fulfilled, (state, action) => {
        state.isCreating = false;
        state.list.unshift(action.payload);
      })
      .addCase(createFamilyMember.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      })
      // updateFamilyMember
      .addCase(updateFamilyMember.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateFamilyMember.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.list.findIndex(member => member.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        if (state.currentMember && state.currentMember.id === action.payload.id) {
          state.currentMember = { ...state.currentMember, ...action.payload };
        }
      })
      .addCase(updateFamilyMember.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      })
      // deleteFamilyMember
      .addCase(deleteFamilyMember.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteFamilyMember.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.list = state.list.filter(member => member.id !== action.payload);
        if (state.currentMember && state.currentMember.id === action.payload) {
          state.currentMember = null;
        }
      })
      .addCase(deleteFamilyMember.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearCurrentMember } = familyMemberSlice.actions;
export default familyMemberSlice.reducer;