import api from './api';

// 搜索医院
export const searchHospitals = async (keyword, province = '') => {
  const response = await api.get('/hospitals/search', {
    params: { keyword, province, limit: 30 }
  });
  return response.data;
};

// 获取所有省份
export const getProvinces = async () => {
  const response = await api.get('/hospitals/provinces');
  return response.data;
};

// 获取所有医院
export const getAllHospitals = async () => {
  const response = await api.get('/hospitals/all');
  return response.data;
};
