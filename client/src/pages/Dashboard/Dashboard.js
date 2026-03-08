import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  List,
  Avatar,
  Tag,
  Space,
  Typography,
  Empty,
  Spin
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  BarChartOutlined,
  PlusOutlined,
  EyeOutlined,
  HeartOutlined,
  TeamOutlined,
  CalendarOutlined
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

  // 获取最近的报告
  const recentReports = [...reports]
    .sort((a, b) => dayjs(b.reportDate).valueOf() - dayjs(a.reportDate).valueOf())
    .slice(0, 5);

  // 获取需要关注的家庭成员（BMI异常等）
  const membersNeedAttention = familyMembers.filter(member => {
    if (!member.bmi) return false;
    const bmi = parseFloat(member.bmi);
    return bmi < 18.5 || bmi >= 28; // 偏瘦或肥胖
  });

  const handleViewMember = (memberId) => {
    navigate(`/family-members/${memberId}`);
  };

  const handleViewReport = (reportId) => {
    navigate(`/reports/${reportId}`);
  };

  const handleAddMember = () => {
    navigate('/family-members');
  };

  const handleUploadReport = () => {
    navigate('/reports/upload');
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 欢迎区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle">
          <Col flex="auto">
            <Space>
              <HeartOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  欢迎回来，{user?.username}！
                </Title>
                <Text type="secondary">
                  今天是 {dayjs().format('YYYY年MM月DD日 dddd')}
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddMember}
              >
                添加家庭成员
              </Button>
              <Button
                icon={<FileTextOutlined />}
                onClick={handleUploadReport}
              >
                上传报告
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="家庭成员"
              value={familyMembers.length}
              prefix={<TeamOutlined />}
              suffix="人"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="医疗报告"
              value={reports.length}
              prefix={<FileTextOutlined />}
              suffix="份"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="监测指标"
              value={indicators.length}
              prefix={<BarChartOutlined />}
              suffix="项"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="需要关注"
              value={membersNeedAttention.length}
              prefix={<HeartOutlined />}
              suffix="人"
              valueStyle={{ color: membersNeedAttention.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 家庭成员概览 */}
        <Col xs={24} lg={12}>
          <Card
            title="家庭成员"
            extra={
              <Button
                type="link"
                onClick={() => navigate('/family-members')}
              >
                查看全部
              </Button>
            }
          >
            {familyMembers.length === 0 ? (
              <Empty
                description="暂无家庭成员"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={handleAddMember}>
                  添加第一个成员
                </Button>
              </Empty>
            ) : (
              <List
                dataSource={familyMembers.slice(0, 4)}
                renderItem={(member) => {
                  const needsAttention = membersNeedAttention.some(m => m.id === member.id);
                  return (
                    <List.Item
                      actions={[
                        <Button
                          type="link"
                          icon={<EyeOutlined />}
                          onClick={() => handleViewMember(member.id)}
                        >
                          查看
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            icon={<UserOutlined />}
                            style={{
                              backgroundColor: member.gender === '男' ? '#1890ff' : '#f759ab'
                            }}
                          >
                            {member.name.charAt(0)}
                          </Avatar>
                        }
                        title={
                          <Space>
                            <span>{member.name}</span>
                            <Tag color={member.gender === '男' ? 'blue' : 'pink'}>
                              {member.gender}
                            </Tag>
                            {needsAttention && (
                              <Tag color="red">需关注</Tag>
                            )}
                          </Space>
                        }
                        description={
                          <Space>
                            <Text type="secondary">{member.relationship}</Text>
                            {member.age && <Text type="secondary">• {member.age}岁</Text>}
                            {member.bmi && <Text type="secondary">• BMI {member.bmi}</Text>}
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

        {/* 最近报告 */}
        <Col xs={24} lg={12}>
          <Card
            title="最近报告"
            extra={
              <Button
                type="link"
                onClick={() => navigate('/reports')}
              >
                查看全部
              </Button>
            }
          >
            {recentReports.length === 0 ? (
              <Empty
                description="暂无医疗报告"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={handleUploadReport}>
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
                      actions={[
                        <Button
                          type="link"
                          icon={<EyeOutlined />}
                          onClick={() => handleViewReport(report.id)}
                        >
                          查看
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            icon={<FileTextOutlined />}
                            style={{ backgroundColor: '#52c41a' }}
                          />
                        }
                        title={
                          <Space>
                            <span>{member?.name || '未知成员'}</span>
                            <Tag icon={<CalendarOutlined />}>
                              {dayjs(report.reportDate).format('MM-DD')}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space>
                            <Text type="secondary">{report.hospitalName}</Text>
                            {report.doctorName && (
                              <Text type="secondary">• {report.doctorName}</Text>
                            )}
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
      </Row>

      {/* 健康提醒 */}
      {membersNeedAttention.length > 0 && (
        <Card
          title="健康提醒"
          style={{ marginTop: 16 }}
          bodyStyle={{ backgroundColor: '#fff2f0' }}
        >
          <List
            dataSource={membersNeedAttention}
            renderItem={(member) => {
              const bmi = parseFloat(member.bmi);
              const status = bmi < 18.5 ? '偏瘦' : '肥胖';
              const color = bmi < 18.5 ? 'blue' : 'red';
              
              return (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      onClick={() => handleViewMember(member.id)}
                    >
                      查看详情
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<HeartOutlined />}
                        style={{ backgroundColor: color }}
                      />
                    }
                    title={`${member.name} - BMI ${status}`}
                    description={`当前BMI: ${member.bmi}，建议关注体重管理和营养均衡`}
                  />
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