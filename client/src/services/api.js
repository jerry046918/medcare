import axios from 'axios';

// 错误类型枚举
const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  SERVER: 'SERVER_ERROR',
  AUTH: 'AUTH_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

let isLoggingOut = false;

// 错误消息映射
const ErrorMessages = {
  [ErrorTypes.NETWORK]: '无法连接到服务器，请检查网络连接或确认后端服务已启动 (端口 3001)',
  [ErrorTypes.TIMEOUT]: '请求超时，请稍后重试',
  [ErrorTypes.SERVER]: '服务器错误，请稍后重试',
  [ErrorTypes.AUTH]: '登录已过期，请重新登录',
  [ErrorTypes.VALIDATION]: '输入数据验证失败',
  [ErrorTypes.RATE_LIMIT]: '请求过于频繁，请稍后再试',
  [ErrorTypes.UNKNOWN]: '发生未知错误'
};

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000, // 增加到 30 秒，OCR 处理可能较慢
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 解析错误类型
 */
function parseErrorType(error) {
  // 网络错误（无响应）
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return ErrorTypes.TIMEOUT;
    }
    return ErrorTypes.NETWORK;
  }

  const { status } = error.response;

  // 认证错误
  if (status === 401) {
    return ErrorTypes.AUTH;
  }

  // 限流错误
  if (status === 429) {
    return ErrorTypes.RATE_LIMIT;
  }

  // 验证错误
  if (status === 400) {
    return ErrorTypes.VALIDATION;
  }

  // 服务器错误
  if (status >= 500) {
    return ErrorTypes.SERVER;
  }

  return ErrorTypes.UNKNOWN;
}

/**
 * 格式化错误信息
 */
function formatError(error) {
  const errorType = parseErrorType(error);
  const { response } = error;

  // 构建错误对象
  const formattedError = {
    type: errorType,
    status: response?.status,
    message: ErrorMessages[errorType],
    details: null,
    retryAfter: null
  };

  // 从响应中提取详细信息
  if (response?.data) {
    const { message, error: errorMsg, retryAfter } = response.data;

    // 使用服务器返回的消息（如果有）
    if (message) {
      formattedError.message = message;
    } else if (errorMsg && typeof errorMsg === 'string') {
      formattedError.message = errorMsg;
    }

    // 限流错误的重试时间
    if (retryAfter) {
      formattedError.retryAfter = retryAfter;
    }

    // 保存完整的错误数据（用于调试）
    formattedError.details = response.data;
  }

  return formattedError;
}

// 响应拦截器：处理通用错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const formattedError = formatError(error);

    // 如果是 401 错误，清除 token
    if (formattedError.type === ErrorTypes.AUTH) {
      const hadToken = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      if (hadToken && !isLoggingOut) {
        isLoggingOut = true;
        window.dispatchEvent(new CustomEvent('auth:logout', {
          detail: { reason: 'token_expired' }
        }));
        setTimeout(() => { isLoggingOut = false; }, 1000);
      }
    }

    // 限流错误日志
    if (formattedError.type === ErrorTypes.RATE_LIMIT) {
      console.warn('[API] 请求被限流:', formattedError.message);
    }

    // 将格式化后的错误附加到原始错误对象
    error.formatted = formattedError;
    error.userMessage = formattedError.message;
    error.errorType = formattedError.type;

    return Promise.reject(error);
  }
);

export default api;
export { ErrorTypes, ErrorMessages };
