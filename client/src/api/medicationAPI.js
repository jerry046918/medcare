import api from './api';

const medicationAPI = {
  // 获取指定成员的所有用药记录
  getByMember: (memberId) => {
    return api.get(`/medications/member/${memberId}`);
  },

  // 获取单个用药记录
  getById: (id) => {
    return api.get(`/medications/${id}`);
  },

  // 创建用药记录
  create: (data) => {
    return api.post('/medications', data);
  },

  // 更新用药记录
  update: (id, data) => {
    return api.put(`/medications/${id}`, data);
  },

  // 删除用药记录
  delete: (id) => {
    return api.delete(`/medications/${id}`);
  }
};

export default medicationAPI;
