import api from './api';

export default {
  list: () => api.get('/users'),
  setRole: (id, role) => api.put(`/users/${id}/role`, { role })
};
