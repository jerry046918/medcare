import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Select,
  DatePicker,
  Input,
  message,
  Popconfirm,
  Empty
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SearchOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchReports, deleteReport, clearError } from '../../store/slices/reportSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';

const { Option } = Select;
const { RangePicker } = DatePicker;

const Reports = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, isLoading, isDeleting, error } = useSelector(state => state.reports);
  const { list: familyMembers } = useSelector(state => state.familyMembers);
  
  const [filters, setFilters] = useState({
    familyMemberId: null,
    dateRange: null,
    hospitalName: ''
  });
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    dispatch(fetchReports());
    dispatch(fetchFamilyMembers());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleAdd = () => {
    navigate('/reports/upload');
  };

  const handleView = (reportId) => {
    navigate(`/reports/${reportId}`);
  };

  const handleEdit = (reportId) => {
    navigate(`/reports/${reportId}/edit`);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await dispatch(deleteReport(id)).unwrap();
      message.success('删除成功');
    } catch (error) {
      // 错误已在Redux中处理
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (report) => {
    if (report.pdfPath) {
      // 这里应该实现PDF下载逻辑
      message.info('PDF下载功能开发中');
    } else {
      message.warning('该报告没有PDF文件');
    }
  };

  // 过滤数据
  const filteredData = list.filter(report => {
    if (filters.familyMemberId && report.familyMemberId !== filters.familyMemberId) {
      return false;
    }
    if (filters.dateRange && filters.dateRange.length === 2) {
      const reportDate = dayjs(report.reportDate);
      if (!reportDate.isBetween(filters.dateRange[0], filters.dateRange[1], 'day', '[]')) {
        return false;
      }
    }
    if (filters.hospitalName && !report.hospitalName.toLowerCase().includes(filters.hospitalName.toLowerCase())) {
      return false;
    }
    return true;
  });

  const columns = [
    {
      title: '报告日期',
      dataIndex: 'reportDate',
      key: 'reportDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a, b) => dayjs(a.reportDate).valueOf() - dayjs(b.reportDate).valueOf(),
      defaultSortOrder: 'descend'
    },
    {
      title: '家庭成员',
      dataIndex: 'familyMemberId',
      key: 'familyMemberId',
      render: (memberId) => {
        const member = familyMembers.find(m => m.id === memberId);
        return member ? (
          <Space>
            <span>{member.name}</span>
            <Tag color={member.gender === '男' ? 'blue' : 'pink'}>{member.gender}</Tag>
          </Space>
        ) : '未知成员';
      }
    },
    {
      title: '医院',
      dataIndex: 'hospitalName',
      key: 'hospitalName'
    },
    {
      title: '医生',
      dataIndex: 'doctorName',
      key: 'doctorName',
      render: (name) => name || '-'
    },
    {
      title: '指标数量',
      dataIndex: 'indicatorCount',
      key: 'indicatorCount',
      render: (count) => (
        <Tag color={count > 0 ? 'green' : 'default'}>
          {count || 0}项
        </Tag>
      )
    },
    {
      title: 'PDF文件',
      dataIndex: 'pdfPath',
      key: 'pdfPath',
      render: (path) => (
        <Tag color={path ? 'blue' : 'default'}>
          {path ? '已上传' : '无文件'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleView(record.id)}
          >
            查看
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record.id)}
          >
            编辑
          </Button>
          {record.pdfPath && (
            <Button
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          )}
          <Popconfirm
            title="确定要删除这份报告吗？"
            description="删除后无法恢复，包括所有相关的指标数据。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              loading={deletingId === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="医疗报告管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            上传报告
          </Button>
        }
      >
        {/* 筛选器 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select
              placeholder="选择家庭成员"
              style={{ width: 150 }}
              allowClear
              value={filters.familyMemberId}
              onChange={(value) => setFilters(prev => ({ ...prev, familyMemberId: value }))}
            >
              {familyMembers.map(member => (
                <Option key={member.id} value={member.id}>
                  {member.name}
                </Option>
              ))}
            </Select>
            
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              value={filters.dateRange}
              onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
            />
            
            <Input
              placeholder="搜索医院名称"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              value={filters.hospitalName}
              onChange={(e) => setFilters(prev => ({ ...prev, hospitalName: e.target.value }))}
              allowClear
            />
          </Space>
        </div>

        {filteredData.length === 0 && !isLoading ? (
          <Empty
            description="暂无医疗报告"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" icon={<FileTextOutlined />} onClick={handleAdd}>
              上传第一份报告
            </Button>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default Reports;