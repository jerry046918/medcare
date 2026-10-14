import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authAPI from '../../api/authAPI';

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
      // 后端响应为 { success, data: { isInitialized, needsSetup } }（v1/v2 一致）
      if (response.data?.data?.needsSetup) {
        return { needsSetup: true, isAuthenticated: false };
      }

      const token = getInitialToken();
      if (!token) {
        return { isAuthenticated: false, needsSetup: false };
      }

      try {
        // v2：用 GET /auth/me 恢复会话（返回 user.role 与 selfMember）
        const meResponse = await authAPI.me();
        const me = meResponse.data.data;
        return {
          isAuthenticated: true,
          user: me.user,
          role: me.user?.role ?? null,
          selfMember: me.selfMember ?? null,
          needsSetup: false,
          token
        };
      } catch (meError) {
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
      // v2 响应：data = { user(含 role), selfMember, token }
      const { user, token, selfMember } = response.data.data;
      // 同步 token 到 localStorage
      syncTokenToStorage(token);
      return { user, token, selfMember: selfMember ?? null };
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
      // v2 响应：data = { user(含 role), token }；selfMember 由注册事务绑定，
      // 响应中可能缺失，缺省为 null（会话恢复时由 /auth/me 补齐）
      const { user, token, selfMember } = response.data.data;
      // 同步 token 到 localStorage
      syncTokenToStorage(token);
      return { user, token, selfMember: selfMember ?? null };
    } catch (error) {
      const message = error.userMessage || error.response?.data?.message || '注册失败';
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  user: null,
  role: null, // v2：冗余自 user.role，便于选择器直接取用
  token: getInitialToken(),
  selfMember: null, // v2：本人成员（GET /auth/me、login 返回）
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
      state.role = null;
      state.selfMember = null;
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
      state.role = null;
      state.selfMember = null;
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
        state.role = action.payload.role || null;
        state.selfMember = action.payload.selfMember || null;
        state.token = action.payload.isAuthenticated
          ? (action.payload.token || state.token)
          : null; // 未认证（token 缺失/校验失败）时清掉残留 token
        state.needsSetup = action.payload.needsSetup || false;
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.role = null;
        state.selfMember = null;
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
        state.role = action.payload.user?.role ?? null;
        state.selfMember = action.payload.selfMember ?? null;
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
        state.role = action.payload.user?.role ?? null;
        state.selfMember = action.payload.selfMember ?? null;
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
