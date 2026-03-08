import React, { useState, useEffect } from 'react';
import { AutoComplete, Spin } from 'antd';
import { searchHospitals } from '../../services/hospitalAPI';

const HospitalAutoComplete = ({ value, onChange, placeholder = '请输入或选择医院', ...restProps }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState(value || '');

  // 当外部value变化时同步
  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  // 搜索医院
  const handleSearch = async (searchValue) => {
    setSearchText(searchValue);
    
    if (!searchValue || searchValue.trim().length < 1) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await searchHospitals(searchValue.trim());
      if (response.success && response.data) {
        const hospitalOptions = response.data.map(hospital => ({
          value: hospital.name,
          label: (
            <div>
              <div style={{ fontWeight: 500 }}>{hospital.name}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                {hospital.province} · {hospital.city}
              </div>
            </div>
          ),
          hospital: hospital
        }));
        setOptions(hospitalOptions);
      }
    } catch (error) {
      console.error('搜索医院失败:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // 选择医院
  const handleSelect = (selectedValue, option) => {
    setSearchText(selectedValue);
    onChange(selectedValue);
  };

  // 输入变化
  const handleChange = (changedValue) => {
    setSearchText(changedValue);
    onChange(changedValue);
  };

  return (
    <AutoComplete
      value={searchText}
      options={options}
      onSearch={handleSearch}
      onSelect={handleSelect}
      onChange={handleChange}
      placeholder={placeholder}
      notFoundContent={loading ? <Spin size="small" /> : '输入医院名称搜索，也可直接输入自定义医院'}
      allowClear
      filterOption={false}
      {...restProps}
    />
  );
};

export default HospitalAutoComplete;
