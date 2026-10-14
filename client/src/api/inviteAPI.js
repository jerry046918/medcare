import api from './api';

export default {
  list: () => api.get('/invites'),
  create: (data) => api.post('/invites', data),
  remove: (id) => api.delete(`/invites/${id}`)
};
