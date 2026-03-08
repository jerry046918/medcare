import api from './api';

const familyMemberAPI = {
  // 获取所有家庭成员
  getAll: () => {
    return api.get('/family-members');
  },

  // 根据ID获取家庭成员详情
  getById: (id) => {
    return api.get(`/family-members/${id}`);
  },

  // 创建家庭成员
  create: (memberData) => {
    return api.post('/family-members', memberData);
  },

  // 更新家庭成员
  update: (id, memberData) => {
    return api.put(`/family-members/${id}`, memberData);
  },

  // 删除家庭成员
  delete: (id) => {
    return api.delete(`/family-members/${id}`);
  },
};

export default familyMemberAPI;