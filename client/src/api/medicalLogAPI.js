import api from './api';

const medicalLogAPI = {
  // 获取指定成员的所有医疗日志
  getByMember: (memberId) => {
    return api.get(`/medical-logs/member/${memberId}`);
  },

  // 获取单个医疗日志
  getById: (id) => {
    return api.get(`/medical-logs/${id}`);
  },

  // 创建医疗日志（手动记录）
  create: (data) => {
    return api.post('/medical-logs', data);
  },

  // 更新医疗日志
  update: (id, data) => {
    return api.put(`/medical-logs/${id}`, data);
  },

  // 删除医疗日志
  delete: (id) => {
    return api.delete(`/medical-logs/${id}`);
  }
};

export default medicalLogAPI;
