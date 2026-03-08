import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Switch,
  Select,
  Divider,
  Space,
  Alert,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  message,
  Table,
  Modal,
  InputNumber,
  Popconfirm,
  Empty,
  Descriptions
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  LockOutlined,
  BellOutlined,
  BarChartOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ScanOutlined
} from '@ant-design/icons';
import { logout } from '../../store/slices/authSlice';
import { fetchIndicators, createIndicator, updateIndicator, deleteIndicator, clearError } from '../../store/slices/indicatorSlice';
import { useNavigate } from 'react-router-dom';
import OCRSettings from './OCRSettings';

const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Settings = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);
  const { list: familyMembers } = useSelector(state => state.familyMembers);
  const { list: reports } = useSelector(state => state.reports);
  const { list: indicators, isLoading, isCreating, isUpdating, isDeleting, error } = useSelector(state => state.indicators);
  const [activeTab, setActiveTab] = useState('profile');
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [systemForm] = Form.useForm();

  // Indicator management state
  const [indicatorModalVisible, setIndicatorModalVisible] = useState(false);
  const [indicatorDetailModalVisible, setIndicatorDetailModalVisible] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState(null);
  const [viewingIndicator, setViewingIndicator] = useState(null);
  const [indicatorFilters, setIndicatorFilters] = useState({
    name: '',
    type: '',
    isDefault: null
  });
  const [indicatorForm] = Form.useForm();

  useEffect(() => {
    dispatch(fetchIndicators());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const indicatorTypes = [
    { value: 'blood', label: '血液检查' },
    { value: 'urine', label: '尿液检查' },
    { value: 'biochemistry', label: '生化检查' },
    { value: 'liver', label: '肝功能' },
    { value: 'kidney', label: '肾功能' },
    { value: 'thyroid', label: '甲状腺功能' },
    { value: 'cardiac', label: '心脏检查' },
    { value: 'other', label: '其他' }
  ];

  const handleValueTypeChange = (value) => {
    if (value === 'numeric') {
      indicatorForm.setFieldsValue({ normalValue: undefined });
    } else if (value === 'qualitative') {
      indicatorForm.setFieldsValue({ normalMin: undefined, normalMax: undefined });
    }
  };

  const handleAddIndicator = () => {
    setEditingIndicator(null);
    indicatorForm.resetFields();
    setIndicatorModalVisible(true);
  };

  const handleEditIndicator = (indicator) => {
    setEditingIndicator(indicator);
    indicatorForm.setFieldsValue(indicator);
    setIndicatorModalVisible(true);
  };

  const handleViewIndicator = (indicator) => {
    setViewingIndicator(indicator);
    setIndicatorDetailModalVisible(true);
  };

  const handleDeleteIndicator = async (id) => {
    try {
      await dispatch(deleteIndicator(id)).unwrap();
      message.success('删除成功');
    } catch (err) {
      // Error handled in Redux
    }
  };

  const handleIndicatorSubmit = async (values) => {
    try {
      if (editingIndicator) {
        await dispatch(updateIndicator({ id: editingIndicator.id, data: values })).unwrap();
        message.success('更新成功');
      } else {
        await dispatch(createIndicator(values)).unwrap();
        message.success('创建成功');
      }
      setIndicatorModalVisible(false);
      indicatorForm.resetFields();
    } catch (err) {
      // Error handled in Redux
    }
  };

  const filteredIndicators = indicators.filter(indicator => {
    if (indicatorFilters.name && !indicator.name.toLowerCase().includes(indicatorFilters.name.toLowerCase())) {
      return false;
    }
    if (indicatorFilters.type && indicator.type !== indicatorFilters.type) {
      return false;
    }
    if (indicatorFilters.isDefault !== null && indicator.isDefault !== indicatorFilters.isDefault) {
      return false;
    }
    return true;
  });

  const indicatorColumns = [
    {
      title: '指标名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: record.isDefault ? 'bold' : 'normal' }}>{text}</span>
          {record.isDefault && <Tag color="blue">默认</Tag>}
        </Space>
      )
    },
    { title: '单位', dataIndex: 'unit', key: 'unit', render: (unit) => unit || '-' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeInfo = indicatorTypes.find(t => t.value === type);
        return <Tag color="geekblue">{typeInfo ? typeInfo.label : type}</Tag>;
      }
    },
    {
      title: '值类型',
      dataIndex: 'valueType',
      key: 'valueType',
      render: (valueType) => {
        if (valueType === 'numeric') return <Tag color="green">数值型</Tag>;
        if (valueType === 'qualitative') return <Tag color="orange">定性型</Tag>;
        return <Tag color="default">未设置</Tag>;
      }
    },
    {
      title: '正常范围',
      key: 'normalRange',
      render: (_, record) => {
        if (record.valueType === 'numeric' && record.normalMin !== null && record.normalMax !== null) {
          return `${record.normalMin} - ${record.normalMax}`;
        }
        if (record.valueType === 'qualitative' && record.normalValue) {
          return record.normalValue === 'positive' ? '阳性' : '阴性';
        }
        return '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="primary" icon={<EyeOutlined />} size="small" onClick={() => handleViewIndicator(record)}>详情</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEditIndicator(record)}>编辑</Button>
          {!record.isDefault && (
            <Popconfirm
              title="确定要删除这个指标吗？"
              description="删除后无法恢复，且会影响相关的报告数据。"
              onConfirm={() => handleDeleteIndicator(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} size="small" loading={isDeleting}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const handleProfileUpdate = (values) => {
    // 这里应该调用更新用户信息的API
    message.success('个人信息更新成功');
  };

  const handlePasswordChange = (values) => {
    // 这里应该调用修改密码的API
    message.success('密码修改成功');
    passwordForm.resetFields();
  };

  const handleSystemUpdate = (values) => {
    // 这里应该调用更新系统设置的API
    message.success('系统设置更新成功');
  };

  const handleLogout = () => {
    dispatch(logout());
    message.success('已退出登录');
    navigate('/login');
  };

  const handleDataExport = () => {
    message.info('数据导出功能开发中');
  };

  const handleDataImport = () => {
    message.info('数据导入功能开发中');
  };

  const handleDatabaseBackup = () => {
    message.info('数据库备份功能开发中');
  };

  return (
    <div>
      <Card title="系统设置">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* 个人资料 */}
          <TabPane tab="个人资料" key="profile" icon={<UserOutlined />}>
            <Row gutter={24}>
              <Col span={16}>
                <Form
                  form={profileForm}
                  layout="vertical"
                  onFinish={handleProfileUpdate}
                  initialValues={{
                    username: user?.username,
                    email: '',
                    phone: '',
                    description: ''
                  }}
                >
                  <Form.Item
                    name="username"
                    label="用户名"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input disabled />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
                  >
                    <Input placeholder="请输入邮箱地址" />
                  </Form.Item>

                  <Form.Item
                    name="phone"
                    label="手机号"
                  >
                    <Input placeholder="请输入手机号" />
                  </Form.Item>

                  <Form.Item
                    name="description"
                    label="个人简介"
                  >
                    <TextArea rows={3} placeholder="请输入个人简介" />
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      更新资料
                    </Button>
                  </Form.Item>
                </Form>
              </Col>
              <Col span={8}>
                <Card title="账户信息" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">用户名</Text>
                      <div>{user?.username}</div>
                    </div>
                    <div>
                      <Text type="secondary">账户类型</Text>
                      <div>
                        <Tag color="blue">管理员</Tag>
                      </div>
                    </div>
                    <div>
                      <Text type="secondary">注册时间</Text>
                      <div>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</div>
                    </div>
                  </Space>
                </Card>
              </Col>
            </Row>
          </TabPane>

          {/* 安全设置 */}
          <TabPane tab="安全设置" key="security" icon={<LockOutlined />}>
            <Row gutter={24}>
              <Col span={16}>
                <Title level={4}>修改密码</Title>
                <Form
                  form={passwordForm}
                  layout="vertical"
                  onFinish={handlePasswordChange}
                >
                  <Form.Item
                    name="currentPassword"
                    label="当前密码"
                    rules={[{ required: true, message: '请输入当前密码' }]}
                  >
                    <Input.Password placeholder="请输入当前密码" />
                  </Form.Item>

                  <Form.Item
                    name="newPassword"
                    label="新密码"
                    rules={[
                      { required: true, message: '请输入新密码' },
                      { min: 6, message: '密码至少6个字符' }
                    ]}
                  >
                    <Input.Password placeholder="请输入新密码" />
                  </Form.Item>

                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true, message: '请确认新密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        }
                      })
                    ]}
                  >
                    <Input.Password placeholder="请再次输入新密码" />
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      修改密码
                    </Button>
                  </Form.Item>
                </Form>

                <Divider />

                <Title level={4}>账户操作</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert
                    message="退出登录"
                    description="退出当前账户，需要重新登录才能访问系统。"
                    type="info"
                    action={
                      <Button size="small" onClick={handleLogout}>
                        退出登录
                      </Button>
                    }
                  />
                </Space>
              </Col>
            </Row>
          </TabPane>

          {/* 系统设置 */}
          <TabPane tab="系统设置" key="system" icon={<SettingOutlined />}>
            <Form
              form={systemForm}
              layout="vertical"
              onFinish={handleSystemUpdate}
              initialValues={{
                language: 'zh-CN',
                theme: 'light',
                notifications: true,
                autoBackup: false,
                dataRetention: 365
              }}
            >
              <Title level={4}>界面设置</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="language"
                    label="语言"
                  >
                    <Select>
                      <Option value="zh-CN">简体中文</Option>
                      <Option value="en-US">English</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="theme"
                    label="主题"
                  >
                    <Select>
                      <Option value="light">浅色主题</Option>
                      <Option value="dark">深色主题</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={4}>通知设置</Title>
              <Form.Item
                name="notifications"
                label="启用通知"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Divider />

              <Title level={4}>数据设置</Title>
              <Form.Item
                name="autoBackup"
                label="自动备份"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="dataRetention"
                label="数据保留天数"
              >
                <Select>
                  <Option value={30}>30天</Option>
                  <Option value={90}>90天</Option>
                  <Option value={180}>180天</Option>
                  <Option value={365}>1年</Option>
                  <Option value={-1}>永久保留</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit">
                  保存设置
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          {/* 数据管理 */}
          <TabPane tab="数据管理" key="data" icon={<DatabaseOutlined />}>
            <Row gutter={24}>
              <Col span={16}>
                <Title level={4}>数据统计</Title>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Statistic
                      title="家庭成员"
                      value={familyMembers?.length || 0}
                      suffix="人"
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="医疗报告"
                      value={reports?.length || 0}
                      suffix="份"
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="健康指标"
                      value={indicators?.length || 0}
                      suffix="项"
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="存储空间"
                      value={0}
                      suffix="MB"
                    />
                  </Col>
                </Row>

                <Divider />

                <Title level={4}>数据操作</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert
                    message="数据导出"
                    description="导出所有数据到Excel文件，包括家庭成员、医疗报告和健康指标。"
                    type="info"
                    action={
                      <Button size="small" onClick={handleDataExport}>
                        导出数据
                      </Button>
                    }
                  />
                  
                  <Alert
                    message="数据导入"
                    description="从Excel文件导入数据，请确保文件格式正确。"
                    type="warning"
                    action={
                      <Button size="small" onClick={handleDataImport}>
                        导入数据
                      </Button>
                    }
                  />
                  
                  <Alert
                    message="数据库备份"
                    description="创建完整的数据库备份，建议定期执行。"
                    type="success"
                    action={
                      <Button size="small" onClick={handleDatabaseBackup}>
                        立即备份
                      </Button>
                    }
                  />
                </Space>
              </Col>
            </Row>
          </TabPane>

          {/* 指标管理 */}
          <TabPane tab="指标管理" key="indicators" icon={<BarChartOutlined />}>
            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Input
                  placeholder="搜索指标名称"
                  prefix={<SearchOutlined />}
                  style={{ width: 200 }}
                  value={indicatorFilters.name}
                  onChange={(e) => setIndicatorFilters(prev => ({ ...prev, name: e.target.value }))}
                  allowClear
                />
                <Select
                  placeholder="选择类型"
                  style={{ width: 150 }}
                  allowClear
                  value={indicatorFilters.type}
                  onChange={(value) => setIndicatorFilters(prev => ({ ...prev, type: value }))}
                >
                  {indicatorTypes.map(type => (
                    <Option key={type.value} value={type.value}>{type.label}</Option>
                  ))}
                </Select>
                <Select
                  placeholder="选择状态"
                  style={{ width: 120 }}
                  allowClear
                  value={indicatorFilters.isDefault}
                  onChange={(value) => setIndicatorFilters(prev => ({ ...prev, isDefault: value }))}
                >
                  <Option value={true}>系统默认</Option>
                  <Option value={false}>自定义</Option>
                </Select>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddIndicator}>添加指标</Button>
              </Space>
            </div>

            {filteredIndicators.length === 0 && !isLoading ? (
              <Empty
                description="暂无健康指标"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" icon={<BarChartOutlined />} onClick={handleAddIndicator}>添加第一个指标</Button>
              </Empty>
            ) : (
              <Table
                columns={indicatorColumns}
                dataSource={filteredIndicators}
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
          </TabPane>

          {/* OCR 设置 */}
          <TabPane tab="OCR 设置" key="ocr" icon={<ScanOutlined />}>
            <OCRSettings />
          </TabPane>

          {/* 关于 */}
          <TabPane tab="关于" key="about" icon={<InfoCircleOutlined />}>
            <Row gutter={24}>
              <Col span={16}>
                <Title level={4}>系统信息</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>系统名称：</Text>
                    <Text>家庭健康管理系统</Text>
                  </div>
                  <div>
                    <Text strong>版本号：</Text>
                    <Text>v1.0.0</Text>
                  </div>
                  <div>
                    <Text strong>开发者：</Text>
                    <Text>健康管理团队</Text>
                  </div>
                  <div>
                    <Text strong>技术栈：</Text>
                    <Text>React + Node.js + SQLite</Text>
                  </div>
                  <div>
                    <Text strong>更新时间：</Text>
                    <Text>{new Date().toLocaleDateString()}</Text>
                  </div>
                </Space>

                <Divider />

                <Title level={4}>功能特性</Title>
                <ul>
                  <li>家庭成员信息管理</li>
                  <li>医疗报告上传与管理</li>
                  <li>健康指标监测与分析</li>
                  <li>数据可视化展示</li>
                  <li>安全的用户认证系统</li>
                  <li>数据导入导出功能</li>
                </ul>

                <Divider />

                <Title level={4}>联系我们</Title>
                <Space direction="vertical">
                  <Text>如果您在使用过程中遇到问题或有建议，请联系我们：</Text>
                  <Text>邮箱：support@healthmanager.com</Text>
                  <Text>电话：400-123-4567</Text>
                </Space>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Card>

      {/* 指标添加/编辑模态框 */}
      <Modal
        title={editingIndicator ? '编辑健康指标' : '添加健康指标'}
        open={indicatorModalVisible}
        onCancel={() => {
          setIndicatorModalVisible(false);
          indicatorForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={indicatorForm}
          layout="vertical"
          onFinish={handleIndicatorSubmit}
        >
          <Form.Item
            name="name"
            label="指标名称"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>
          <Form.Item name="unit" label="单位">
            <Input placeholder="请输入单位，如：mg/dL, mmol/L" />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择指标类型' }]}
          >
            <Select placeholder="请选择指标类型">
              {indicatorTypes.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="valueType"
            label="值类型"
            rules={[{ required: true, message: '请选择值类型' }]}
          >
            <Select placeholder="请选择值类型" onChange={handleValueTypeChange}>
              <Option value="numeric">数值型</Option>
              <Option value="qualitative">定性型（阴性/阳性）</Option>
            </Select>
          </Form.Item>
          <Form.Item name="testMethod" label="测试方法">
            <Input placeholder="请输入测试方法" />
          </Form.Item>
          <Form.Item name="referenceRange" label="参考范围（文本描述）">
            <Input placeholder="请输入参考范围，如：3.5-5.0" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.valueType !== currentValues.valueType}
          >
            {({ getFieldValue }) => {
              const valueType = getFieldValue('valueType');
              return valueType === 'numeric' ? (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="normalMin"
                        label="最小正常值"
                        rules={[{ required: true, message: '请输入最小正常值' }]}
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="请输入最小值" precision={2} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="normalMax"
                        label="最大正常值"
                        rules={[{ required: true, message: '请输入最大正常值' }]}
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="请输入最大值" precision={2} />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ) : valueType === 'qualitative' ? (
                <Form.Item
                  name="normalValue"
                  label="正常值"
                  rules={[{ required: true, message: '请选择正常值' }]}
                >
                  <Select placeholder="请选择正常值">
                    <Option value="negative">阴性</Option>
                    <Option value="positive">阳性</Option>
                  </Select>
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入指标描述" />
          </Form.Item>
          <Form.Item name="isDefault" label="设为默认指标" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={isCreating || isUpdating}>
                {editingIndicator ? '更新' : '创建'}
              </Button>
              <Button onClick={() => {
                setIndicatorModalVisible(false);
                indicatorForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 指标详情模态框 */}
      <Modal
        title="指标详情"
        open={indicatorDetailModalVisible}
        onCancel={() => setIndicatorDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIndicatorDetailModalVisible(false)}>关闭</Button>
        ]}
        width={600}
      >
        {viewingIndicator && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="指标名称">{viewingIndicator.name}</Descriptions.Item>
            <Descriptions.Item label="单位">{viewingIndicator.unit || '-'}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color="geekblue">
                {indicatorTypes.find(t => t.value === viewingIndicator.type)?.label || viewingIndicator.type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="值类型">
              {viewingIndicator.valueType === 'numeric' ? (
                <Tag color="green">数值型</Tag>
              ) : viewingIndicator.valueType === 'qualitative' ? (
                <Tag color="orange">定性型</Tag>
              ) : (
                <Tag color="default">未设置</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="正常范围">
              {viewingIndicator.valueType === 'numeric' && viewingIndicator.normalMin !== null && viewingIndicator.normalMax !== null
                ? `${viewingIndicator.normalMin} - ${viewingIndicator.normalMax}`
                : viewingIndicator.valueType === 'qualitative' && viewingIndicator.normalValue
                  ? (viewingIndicator.normalValue === 'positive' ? '阳性' : '阴性')
                  : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="测试方法">{viewingIndicator.testMethod || '-'}</Descriptions.Item>
            <Descriptions.Item label="参考范围（文本）">{viewingIndicator.referenceRange || '-'}</Descriptions.Item>
            <Descriptions.Item label="描述">{viewingIndicator.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={viewingIndicator.isDefault ? 'blue' : 'default'}>
                {viewingIndicator.isDefault ? '系统默认' : '自定义'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Settings;