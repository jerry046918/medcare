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

  // 可认领成员（无 self link，仅 id/name/gender/birthday；本人绑定/专属邀请码下拉用）
  listClaimable: () => {
    return api.get('/members', { params: { claimable: 1 } });
  },

  // 成员授权(links)管理（list/grant 仅 self/owner/admin）
  listLinks: (memberId) => {
    return api.get(`/members/${memberId}/links`);
  },

  grantLink: (memberId, data) => {
    return api.post(`/members/${memberId}/links`, data);
  },

  revokeLink: (memberId, linkId) => {
    return api.delete(`/members/${memberId}/links/${linkId}`);
  },

  // 成员合并（admin：source 数据并入 target 后删除 source）
  merge: (sourceId, targetId) => {
    return api.post('/members/merge', { sourceId, targetId });
  },
};

export default familyMemberAPI;
