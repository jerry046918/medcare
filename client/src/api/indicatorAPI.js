import api from './api';

const indicatorAPI = {
  // 获取所有指标
  getAll: () => {
    return api.get('/indicators');
  },

  // 根据ID获取指标详情
  getById: (id) => {
    return api.get(`/indicators/${id}`);
  },

  // 创建指标
  create: (indicatorData) => {
    return api.post('/indicators', indicatorData);
  },

  // 更新指标
  update: (id, indicatorData) => {
    return api.put(`/indicators/${id}`, indicatorData);
  },

  // 删除指标
  delete: (id) => {
    return api.delete(`/indicators/${id}`);
  },
};

export default indicatorAPI;