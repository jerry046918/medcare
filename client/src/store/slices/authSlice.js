import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authAPI from '../../services/authAPI';

/**
 * 从 localStorage 获取初始 token
 * 使用单一数据源原则：localStorage 是 token 的真实来源
 */
const getInitialToken = () => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

/**
 * 同步 token 到 localStorage
 */
const syncTokenToStorage = (token) => {
  try {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  } catch (error) {
    console.error('[Auth] 同步 token 失败:', error);
  }
};

// 异步thunk：检查认证状态
export const checkAuthStatus = createAsyncThunk(
  'auth/checkAuthStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.checkInitStatus();
      if (response.data.needsSetup) {
        return { needsSetup: true, isAuthenticated: false };
      }

      const token = getInitialToken();
      if (!token) {
        return { isAuthenticated: false, needsSetup: false };
      }

      try {
        const verifyResponse = await authAPI.verifyToken();
        return {
          isAuthenticated: true,
          user: verifyResponse.data.data.user,
          needsSetup: false,
          token
        };
      } catch (verifyError) {
        // Token验证失败，清除token
        syncTokenToStorage(null);
        return { isAuthenticated: false, needsSetup: false };
      }
    } catch (error) {
      syncTokenToStorage(null);
      return { isAuthenticated: false, needsSetup: false };
    }
  }
);

// 异步thunk：用户登录
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(credentials);
      const { user, token } = response.data.data;
      // 同步 token 到 localStorage
      syncTokenToStorage(token);
      return { user, token };
    } catch (error) {
      const message = error.userMessage || error.response?.data?.message || '登录失败';
      return rejectWithValue(message);
    }
  }
);

// 异步thunk：用户注册
export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authAPI.register(userData);
      const { user, token } = response.data.data;
      // 同步 token 到 localStorage
      syncTokenToStorage(token);
      return { user, token };
    } catch (error) {
      const message = error.userMessage || error.response?.data?.message || '注册失败';
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  user: null,
  token: getInitialToken(),
  isAuthenticated: false,
  isLoading: true,
  needsSetup: false,
  error: null,
  logoutReason: null // 登出原因（用于显示不同的提示）
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state, action) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.logoutReason = action?.payload?.reason || null;
      syncTokenToStorage(null);
    },
    clearError: (state) => {
      state.error = null;
    },
    clearLogoutReason: (state) => {
      state.logoutReason = null;
    },
    // 处理来自 API 拦截器的登出事件
    handleAuthExpired: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.logoutReason = 'token_expired';
    }
  },
  extraReducers: (builder) => {
    builder
      // checkAuthStatus
      .addCase(checkAuthStatus.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = action.payload.isAuthenticated || false;
        state.user = action.payload.user || null;
        state.token = action.payload.token || state.token;
        state.needsSetup = action.payload.needsSetup || false;
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.needsSetup = false;
      })
      // login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.needsSetup = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.needsSetup = false;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { logout, clearError, clearLogoutReason, handleAuthExpired } = authSlice.actions;
export default authSlice.reducer;
