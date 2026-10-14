import api from './api';

const familyMemberAPI = {
  // 获取可见家庭成员（v2 列表项含 role/relationship/age/bmi/reportCount，无 reports 数组）
  getAll: () => {
    return api.get('/members');
  },

  // 根据ID获取家庭成员详情（含 reports）
  getById: (id) => {
    return api.get(`/members/${id}`);
  },

  // 创建家庭成员
  create: (memberData) => {
    return api.post('/members', memberData);
  },

  // 更新家庭成员
  update: (id, memberData) => {
    return api.put(`/members/${id}`, memberData);
  },

  // 删除家庭成员
  delete: (id) => {
    return api.delete(`/members/${id}`);
  },

  // 登录态补绑本人成员（v2：老账户无 self 绑定时调用）
  bindSelf: (payload) => {
    return api.post('/members/bind-self', payload);
  },
};

export default familyMemberAPI;
