import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 10000,
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

// 响应拦截器：处理通用错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 如果是401错误，清除token（但不直接跳转，让Redux处理）
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // 不直接跳转，让应用的认证逻辑处理
    }
    
    // 确保错误信息是字符串
    if (!error.response) {
      // 网络错误或服务器未启动
      error.userMessage = '无法连接到服务器，请确保后端服务已启动 (端口 3001)';
    } else if (error.response.data?.message) {
      error.userMessage = error.response.data.message;
    } else if (error.response.data?.error) {
      error.userMessage = typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : '服务器错误';
    } else {
      error.userMessage = `请求失败 (${error.response.status})`;
    }
    
    return Promise.reject(error);
  }
);

export default api;