import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Button,
  List,
  Avatar,
  Tag,
  Space,
  Typography,
  Empty,
  Spin,
  Tooltip
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  BarChartOutlined,
  PlusOutlined,
  EyeOutlined,
  HeartOutlined,
  TeamOutlined,
  CalendarOutlined,
  UploadOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';
import { fetchReports } from '../../store/slices/reportSlice';
import { fetchIndicators } from '../../store/slices/indicatorSlice';

const { Title, Text } = Typography;

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector(state => state.auth);
  const { list: familyMembers, isLoading: membersLoading } = useSelector(state => state.familyMembers);
  const { list: reports, isLoading: reportsLoading } = useSelector(state => state.reports);
  const { list: indicators, isLoading: indicatorsLoading } = useSelector(state => state.indicators);

  useEffect(() => {
    dispatch(fetchFamilyMembers());
    dispatch(fetchReports());
    dispatch(fetchIndicators());
  }, [dispatch]);

  const isLoading = membersLoading || reportsLoading || indicatorsLoading;

  const recentReports = useMemo(() => [...reports]
    .sort((a, b) => dayjs(b.reportDate).valueOf() - dayjs(a.reportDate).valueOf())
    .slice(0, 5), [reports]);

  const membersNeedAttention = useMemo(() => familyMembers.filter(member => {
    if (!member.bmi) return false;
    const bmi = parseFloat(member.bmi);
    return bmi < 18.5 || bmi >= 28;
  }), [familyMembers]);

  const statCards = [
    {
      title: '家庭成员',
      value: familyMembers.length,
      suffix: '人',
      icon: <TeamOutlined />,
      color: '#3b82f6',
      bg: '#eff6ff'
    },
    {
      title: '医疗报告',
      value: reports.length,
      suffix: '份',
      icon: <FileTextOutlined />,
      color: '#10b981',
      bg: '#ecfdf5'
    },
    {
      title: '监测指标',
      value: indicators.length,
      suffix: '项',
      icon: <BarChartOutlined />,
      color: '#8b5cf6',
      bg: '#f5f3ff'
    },
    {
      title: '需要关注',
      value: membersNeedAttention.length,
      suffix: '人',
      icon: <HeartOutlined />,
      color: membersNeedAttention.length > 0 ? '#ef4444' : '#10b981',
      bg: membersNeedAttention.length > 0 ? '#fef2f2' : '#ecfdf5'
    }
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Banner */}
      <div className="welcome-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Title level={3}>欢迎回来，{user?.username} 👋</Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            {dayjs().format('YYYY年MM月DD日 dddd')}
          </Text>
        </div>
        <Space style={{ position: 'relative', zIndex: 1 }}>
          <Button
            className="welcome-btn"
            icon={<UploadOutlined />}
            onClick={() => navigate('/reports/upload')}
          >
            上传报告
          </Button>
          <Button
            className="welcome-btn"
            icon={<PlusOutlined />}
            onClick={() => navigate('/family-members')}
          >
            添加成员
          </Button>
        </Space>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((stat, idx) => (
          <Col xs={12} sm={12} lg={6} key={idx}>
            <Card className="stat-card" bodyStyle={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>{stat.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
                    {stat.value}
                    <span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8', marginLeft: 4 }}>{stat.suffix}</span>
                  </div>
                </div>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: stat.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  color: stat.color
                }}>
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main Content: Members + Reports */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                <TeamOutlined style={{ marginRight: 8, color: '#3b82f6' }} />
                家庭成员
              </span>
            }
            extra={
              <Button type="link" onClick={() => navigate('/family-members')} style={{ fontSize: 13 }}>
                查看全部 <ArrowRightOutlined />
              </Button>
            }
            style={{ height: '100%' }}
          >
            {familyMembers.length === 0 ? (
              <Empty
                description="暂无家庭成员"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={() => navigate('/family-members')}>
                  添加第一个成员
                </Button>
              </Empty>
            ) : (
              <List
                dataSource={familyMembers.slice(0, 5)}
                renderItem={(member) => {
                  const needsAttention = membersNeedAttention.some(m => m.id === member.id);
                  return (
                    <List.Item
                      style={{ padding: '12px 0', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                      actions={[
                        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/family-members/${member.id}`)}>
                          查看
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size={40}
                            style={{
                              backgroundColor: member.gender === '男' ? '#3b82f6' : '#ec4899',
                              fontSize: 16,
                              fontWeight: 600
                            }}
                          >
                            {member.name.charAt(0)}
                          </Avatar>
                        }
                        title={
                          <Space>
                            <span style={{ fontWeight: 500 }}>{member.name}</span>
                            <Tag color={member.gender === '男' ? 'blue' : 'pink'} style={{ fontSize: 11 }}>
                              {member.gender}
                            </Tag>
                            {needsAttention && (
                              <Tooltip title="BMI异常，建议关注">
                                <Tag color="error" icon={<ExclamationCircleOutlined />} style={{ fontSize: 11 }}>需关注</Tag>
                              </Tooltip>
                            )}
                          </Space>
                        }
                        description={
                          <Space size={4} style={{ fontSize: 13 }}>
                            <Text type="secondary">{member.relationship}</Text>
                            {member.age && <><Text type="secondary">·</Text><Text type="secondary">{member.age}岁</Text></>}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                <FileTextOutlined style={{ marginRight: 8, color: '#10b981' }} />
                最近报告
              </span>
            }
            extra={
              <Button type="link" onClick={() => navigate('/reports')} style={{ fontSize: 13 }}>
                查看全部 <ArrowRightOutlined />
              </Button>
            }
            style={{ height: '100%' }}
          >
            {recentReports.length === 0 ? (
              <Empty
                description="暂无医疗报告"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={() => navigate('/reports/upload')}>
                  上传第一份报告
                </Button>
              </Empty>
            ) : (
              <List
                dataSource={recentReports}
                renderItem={(report) => {
                  const member = familyMembers.find(m => m.id === report.familyMemberId);
                  return (
                    <List.Item
                      style={{ padding: '12px 0', cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                      actions={[
                        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/reports/${report.id}`)}>
                          查看
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size={40}
                            icon={<FileTextOutlined />}
                            style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}
                          />
                        }
                        title={
                          <Space>
                            <span style={{ fontWeight: 500 }}>{member?.name || '未知成员'}</span>
                            <Tag icon={<CalendarOutlined />} style={{ fontSize: 11 }}>
                              {dayjs(report.reportDate).format('MM-DD')}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {report.hospitalName || '未知医院'}
                          </Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Health Alerts */}
      {membersNeedAttention.length > 0 && (
        <Card
          style={{ marginTop: 16 }}
          styles={{ body: { background: 'linear-gradient(135deg, #fef2f2, #fff1f2)', padding: 16 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ExclamationCircleOutlined style={{ color: '#ef4444', fontSize: 18 }} />
            <span style={{ fontWeight: 600, color: '#991b1b', fontSize: 15 }}>健康提醒</span>
          </div>
          <List
            dataSource={membersNeedAttention}
            renderItem={(member) => {
              const bmi = parseFloat(member.bmi);
              const status = bmi < 18.5 ? '偏瘦' : '肥胖';
              return (
                <List.Item style={{ padding: '8px 0', border: 'none' }}>
                  <Space>
                    <Avatar
                      size={32}
                      style={{ backgroundColor: bmi < 18.5 ? '#3b82f6' : '#ef4444', fontSize: 14 }}
                    >
                      {member.name.charAt(0)}
                    </Avatar>
                    <div>
                      <Text strong>{member.name}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        BMI {status}（{member.bmi}）· 建议关注体重管理
                      </Text>
                    </div>
                    <Button type="link" size="small" onClick={() => navigate(`/family-members/${member.id}`)}>
                      查看详情
                    </Button>
                  </Space>
                </List.Item>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
