import api from './api';

const reportAPI = {
  // 获取所有报告
  getAll: () => {
    return api.get('/reports');
  },

  // 根据ID获取报告详情
  getById: (id) => {
    return api.get(`/reports/${id}`);
  },

  // 创建报告
  create: (reportData) => {
    // 检查是否有文件上传
    if (reportData.pdfFile instanceof File) {
      const formData = new FormData();
      
      // 添加基本字段
      formData.append('familyMemberId', reportData.familyMemberId);
      formData.append('reportDate', reportData.reportDate);
      if (reportData.hospitalName) formData.append('hospitalName', reportData.hospitalName);
      if (reportData.doctorName) formData.append('doctorName', reportData.doctorName);
      if (reportData.notes) formData.append('notes', reportData.notes);
      
      // 添加指标数据（需要序列化为 JSON 字符串）
      if (reportData.indicatorData && reportData.indicatorData.length > 0) {
        formData.append('indicatorData', JSON.stringify(reportData.indicatorData));
      }
      
      // 添加文件
      formData.append('pdfFile', reportData.pdfFile);
      
      return api.post('/reports', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } else {
      // 没有文件，使用 JSON
      return api.post('/reports', reportData);
    }
  },

  // 更新报告
  update: (id, reportData) => {
    return api.put(`/reports/${id}`, reportData);
  },

  // 删除报告
  delete: (id) => {
    return api.delete(`/reports/${id}`);
  },
};

export default reportAPI;
