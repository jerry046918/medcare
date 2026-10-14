import api from './api';

const reportAPI = {
  getAll: () => {
    return api.get('/reports');
  },

  getById: (id) => {
    return api.get(`/reports/${id}`);
  },

  create: (reportData) => {
    if (reportData.reportFile instanceof File) {
      const formData = new FormData();

      formData.append('familyMemberId', reportData.familyMemberId);
      formData.append('reportDate', reportData.reportDate);
      if (reportData.hospitalName) formData.append('hospitalName', reportData.hospitalName);
      if (reportData.doctorName) formData.append('doctorName', reportData.doctorName);
      if (reportData.notes) formData.append('notes', reportData.notes);

      if (reportData.indicatorData && reportData.indicatorData.length > 0) {
        formData.append('indicatorData', JSON.stringify(reportData.indicatorData));
      }

      formData.append('file', reportData.reportFile);

      return api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }

    return api.post('/reports', reportData);
  },

  update: (id, reportData) => {
    if (reportData.reportFile instanceof File) {
      const formData = new FormData();

      formData.append('familyMemberId', reportData.familyMemberId);
      formData.append('reportDate', reportData.reportDate);
      if (reportData.hospitalName) formData.append('hospitalName', reportData.hospitalName);
      if (reportData.doctorName) formData.append('doctorName', reportData.doctorName);
      if (reportData.notes) formData.append('notes', reportData.notes);

      if (reportData.indicatorData && reportData.indicatorData.length > 0) {
        formData.append('indicatorData', JSON.stringify(reportData.indicatorData));
      }

      formData.append('file', reportData.reportFile);

      return api.put(`/reports/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }

    return api.put(`/reports/${id}`, reportData);
  },

  delete: (id) => {
    return api.delete(`/reports/${id}`);
  },
};

export default reportAPI;
