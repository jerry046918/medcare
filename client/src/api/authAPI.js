import api from './api';

const authAPI = {
  // 用户注册（v2：payload 含 inviteCode/mode/memberData/claimMemberId，由注册页组装）
  register: (userData) => {
    return api.post('/auth/register', userData);
  },

  // 用户登录
  login: (credentials) => {
    return api.post('/auth/login', credentials);
  },

  // 当前登录用户信息 + 本人成员（v2：取代 verifyToken 的会话恢复入口）
  me: () => {
    return api.get('/auth/me');
  },

  // 注册向导邀请码预览（专属码 → 绑定成员；通用码 → 可认领成员列表）
  previewInvite: (inviteCode) => {
    return api.post('/auth/preview-invite', { inviteCode });
  },

  // 检查系统初始化状态
  checkInitStatus: () => {
    return api.get('/auth/init-status');
  },

  // 修改密码
  changePassword: (data) => {
    return api.post('/auth/change-password', data);
  },

  // 更新个人资料（v2：displayName，仅允许改自己的）
  updateProfile: (data) => {
    return api.post('/auth/update-profile', data);
  },

  // 登出（客户端处理）
  logout: () => {
    localStorage.removeItem('token');
    return Promise.resolve();
  },
};

export default authAPI;
