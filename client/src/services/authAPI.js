import api from './api';

const authAPI = {
  // 用户注册
  register: (userData) => {
    return api.post('/auth/register', userData);
  },

  // 用户登录
  login: (credentials) => {
    return api.post('/auth/login', credentials);
  },

  // 验证token
  verifyToken: () => {
    return api.get('/auth/verify');
  },

  // 检查系统初始化状态
  checkInitStatus: () => {
    return api.get('/auth/init-status');
  },

  // 修改密码
  changePassword: (data) => {
    return api.post('/auth/change-password', data);
  },

  // 登出（客户端处理）
  logout: () => {
    localStorage.removeItem('token');
    return Promise.resolve();
  },
};

export default authAPI;