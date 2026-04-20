import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Table,
  Tag,
  Spin,
  Alert,
  Empty,
  Typography,
  Row,
  Col,
  Statistic,
  message
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DownloadOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PieChartOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchReportDetail } from '../../store/slices/reportSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';

const { Title, Text } = Typography;

const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { currentReport, isLoading, error } = useSelector(state => state.reports);
  const { list: familyMembers } = useSelector(state => state.familyMembers);

  useEffect(() => {
    if (id) {
      dispatch(fetchReportDetail(id));
      dispatch(fetchFamilyMembers());
    }
  }, [dispatch, id]);

  const handleEdit = () => {
    navigate(`/reports/${id}/edit`);
  };

  const handleDownload = async () => {
    if (currentReport?.filePath) {
      const filename = currentReport.filePath.split('/').pop();
      const token = localStorage.getItem('token');
      try {
        const response = await fetch(`/api/files/reports/${filename}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = currentReport.fileName || filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } else {
          message.error('下载失败');
        }
      } catch (error) {
        message.error('下载失败');
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="加载失败"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={() => navigate('/reports')}>
            返回列表
          </Button>
        }
      />
    );
  }

  if (!currentReport) {
    return (
      <Empty
        description="报告不存在"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <Button type="primary" onClick={() => navigate('/reports')}>
          返回列表
        </Button>
      </Empty>
    );
  }

  const member = familyMembers.find(m => m.id === currentReport.familyMemberId);
  const indicatorData = currentReport.indicatorData || [];
  const normalCount = indicatorData.filter(item => item.isNormal).length;
  const abnormalCount = indicatorData.length - normalCount;

  const indicatorColumns = [
    {
      title: '指标名称',
      dataIndex: ['indicator', 'name'],
      key: 'indicatorName',
      render: (name, record) => (
        <Space>
          <MedicineBoxOutlined />
          <span>{name}</span>
        </Space>
      )
    },
    {
      title: '检测值',
      dataIndex: 'value',
      key: 'value',
      render: (value, record) => {
        if (record.indicator?.valueType === 'qualitative') {
          const displayValue = value === 'positive' ? '阳性' : value === 'negative' ? '阴性' : value;
          return (
            <Text strong style={{ fontSize: 16 }}>
              {displayValue}
            </Text>
          );
        }
        
        return (
          <Text strong style={{ fontSize: 16 }}>
            {value} {record.indicator?.unit}
          </Text>
        );
      }
    },
    {
      title: '参考范围',
      dataIndex: 'referenceRange',
      key: 'referenceRange',
      render: (range) => (
        <Text type="secondary">{range || '-'}</Text>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const { isNormal, abnormalType } = record;
        
        if (isNormal === true || abnormalType === 'normal') {
          return <Tag color="green">正常</Tag>;
        } else if (abnormalType === 'high') {
          return <Tag color="red">偏高</Tag>;
        } else if (abnormalType === 'low') {
          return <Tag color="orange">偏低</Tag>;
        } else if (abnormalType === 'abnormal') {
          return <Tag color="red">异常</Tag>;
        } else if (isNormal === false) {
          return <Tag color="red">异常</Tag>;
        }
        
        return <Tag color="default">未判断</Tag>;
      }
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      render: (notes) => notes || '-'
    }
  ];

  return (
    <div className="page-fade-in">
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/reports')}
            >
              返回
            </Button>
            <FileTextOutlined />
            <span>医疗报告详情</span>
          </Space>
        }
        extra={
          <Space>
            {currentReport.filePath && (
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownload}
              >
                下载附件
              </Button>
            )}
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleEdit}
            >
              编辑
            </Button>
          </Space>
        }
      >
        {/* 基本信息 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={18}>
            <Descriptions
              title="基本信息"
              bordered
              column={2}
              size="middle"
            >
              <Descriptions.Item label="家庭成员" span={1}>
                <Space>
                  <UserOutlined />
                  <span>{member?.name || '未知成员'}</span>
                  {member && (
                    <Tag color={member.gender === '男' ? 'blue' : 'pink'}>
                      {member.gender}
                    </Tag>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="报告日期" span={1}>
                <Space>
                  <CalendarOutlined />
                  <span>{dayjs(currentReport.reportDate).format('YYYY年MM月DD日')}</span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="医院名称" span={1}>
                {currentReport.hospitalName}
              </Descriptions.Item>
              <Descriptions.Item label="医生姓名" span={1}>
                {currentReport.doctorName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="报告附件" span={1}>
                <Tag color={currentReport.filePath ? 'blue' : 'default'}>
                  {currentReport.filePath ? '已上传' : '无文件'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={1}>
                {dayjs(currentReport.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              {currentReport.notes && (
                <Descriptions.Item label="备注信息" span={2}>
                  {currentReport.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Col>
          <Col span={6}>
            <Row gutter={[0, 16]}>
              <Col span={24}>
                <Card size="small" className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
                  <Statistic
                    title="总指标数"
                    value={indicatorData.length}
                    suffix="项"
                    prefix={<PieChartOutlined style={{ fontSize: 18, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: 6, borderRadius: 6 }} />}
                    valueStyle={{ color: '#3b82f6', fontSize: 22 }}
                  />
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small" className="stat-card" style={{ borderLeft: '3px solid #22c55e' }}>
                  <Statistic
                    title="正常指标"
                    value={normalCount}
                    suffix="项"
                    prefix={<CheckCircleOutlined style={{ fontSize: 18, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: 6, borderRadius: 6 }} />}
                    valueStyle={{ color: '#22c55e', fontSize: 22 }}
                  />
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small" className="stat-card" style={{ borderLeft: `3px solid ${abnormalCount > 0 ? '#ef4444' : '#22c55e'}` }}>
                  <Statistic
                    title="异常指标"
                    value={abnormalCount}
                    suffix="项"
                    prefix={<CloseCircleOutlined style={{ fontSize: 18, color: abnormalCount > 0 ? '#ef4444' : '#22c55e', background: abnormalCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', padding: 6, borderRadius: 6 }} />}
                    valueStyle={{ color: abnormalCount > 0 ? '#ef4444' : '#22c55e', fontSize: 22 }}
                  />
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>

        {/* 指标数据 */}
        <Card
          title={
            <Space>
              <MedicineBoxOutlined style={{ color: '#3b82f6' }} />
              <span>指标数据</span>
            </Space>
          }
          size="small"
          style={{ marginTop: 24 }}
        >
          {indicatorData.length === 0 ? (
            <Empty
              description="暂无指标数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Table
              columns={indicatorColumns}
              dataSource={indicatorData}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 项指标`
              }}
              rowClassName={(record) =>
                !record.isNormal && record.isNormal !== null ? 'row-abnormal' : ''
              }
              onRow={(record) => ({
                style: {
                  backgroundColor: (!record.isNormal && record.isNormal !== null) ? '#fff1f0' : undefined
                }
              })}
            />
          )}
        </Card>
      </Card>

    </div>
  );
};

export default ReportDetail;