import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Avatar,
  Tag,
  Spin,
  Alert,
  Tabs,
  Table,
  Empty,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Timeline
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  HistoryOutlined,
  PlusOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchFamilyMemberDetail } from '../../store/slices/familyMemberSlice';
import { fetchReports } from '../../store/slices/reportSlice';
import { fetchMedications, createMedication, updateMedication, deleteMedication } from '../../store/slices/medicationSlice';
import { fetchMedicalLogs, createMedicalLog, deleteMedicalLog } from '../../store/slices/medicalLogSlice';
import HospitalAutoComplete from '../../components/common/HospitalAutoComplete';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const FamilyMemberDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { currentMember, isLoading, error } = useSelector(state => state.familyMembers);
  const { list: reports, isLoading: reportsLoading } = useSelector(state => state.reports);
  const { list: medications, isLoading: medicationsLoading, isCreating: isCreatingMedication } = useSelector(state => state.medications);
  const { list: medicalLogs, isLoading: logsLoading, isCreating: isCreatingLog } = useSelector(state => state.medicalLogs);
  
  const [activeTab, setActiveTab] = useState('basic');
  const [medicationModalVisible, setMedicationModalVisible] = useState(false);
  const [medicalLogModalVisible, setMedicalLogModalVisible] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [medicationForm] = Form.useForm();
  const [medicalLogForm] = Form.useForm();

  useEffect(() => {
    if (id) {
      dispatch(fetchFamilyMemberDetail(id));
      dispatch(fetchReports({ familyMemberId: parseInt(id) }));
      dispatch(fetchMedications(id));
      dispatch(fetchMedicalLogs(id));
    }
  }, [dispatch, id]);

  const handleBack = () => {
    navigate('/family-members');
  };

  const handleEdit = () => {
    navigate(`/family-members/${id}/edit`);
  };

  const handleViewReport = (reportId) => {
    navigate(`/reports/${reportId}`);
  };

  // 用药记录相关操作
  const handleAddMedication = () => {
    setEditingMedication(null);
    medicationForm.resetFields();
    setMedicationModalVisible(true);
  };

  const handleEditMedication = (medication) => {
    setEditingMedication(medication);
    medicationForm.setFieldsValue({
      name: medication.name,
      specification: medication.specification,
      frequency: medication.frequency,
      notes: medication.notes
    });
    setMedicationModalVisible(true);
  };

  const handleMedicationSubmit = async (values) => {
    try {
      if (editingMedication) {
        await dispatch(updateMedication({ id: editingMedication.id, data: values })).unwrap();
        message.success('用药记录更新成功');
      } else {
        await dispatch(createMedication({ memberId: parseInt(id), ...values })).unwrap();
        message.success('用药记录添加成功');
      }
      setMedicationModalVisible(false);
      medicationForm.resetFields();
      dispatch(fetchMedications(id));
      dispatch(fetchMedicalLogs(id)); // 刷新日志
    } catch (error) {
      message.error(error || '操作失败');
    }
  };

  const handleToggleMedication = async (medication) => {
    try {
      await dispatch(updateMedication({ 
        id: medication.id, 
        data: { isActive: !medication.isActive } 
      })).unwrap();
      message.success(medication.isActive ? '已停用该用药' : '已恢复该用药');
      dispatch(fetchMedications(id));
      dispatch(fetchMedicalLogs(id));
    } catch (error) {
      message.error(error || '操作失败');
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    try {
      await dispatch(deleteMedication(medicationId)).unwrap();
      message.success('用药记录删除成功');
      dispatch(fetchMedications(id));
    } catch (error) {
      message.error(error || '删除失败');
    }
  };

  // 医疗日志相关操作
  const handleAddMedicalLog = () => {
    medicalLogForm.resetFields();
    setMedicalLogModalVisible(true);
  };

  const handleMedicalLogSubmit = async (values) => {
    try {
      await dispatch(createMedicalLog({
        memberId: parseInt(id),
        logType: values.logType,
        title: values.title,
        description: values.description,
        hospital: values.hospital,
        treatmentStartDate: values.treatmentStartDate ? values.treatmentStartDate.toISOString() : new Date().toISOString(),
        treatmentEndDate: values.treatmentEndDate ? values.treatmentEndDate.toISOString() : null
      })).unwrap();
      message.success('医疗日志添加成功');
      setMedicalLogModalVisible(false);
      medicalLogForm.resetFields();
      dispatch(fetchMedicalLogs(id));
    } catch (error) {
      message.error(error || '添加失败');
    }
  };

  const handleDeleteMedicalLog = async (logId) => {
    try {
      await dispatch(deleteMedicalLog(logId)).unwrap();
      message.success('日志删除成功');
      dispatch(fetchMedicalLogs(id));
    } catch (error) {
      message.error(error || '删除失败');
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
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
          <Button size="small" onClick={handleBack}>
            返回列表
          </Button>
        }
      />
    );
  }

  if (!currentMember) {
    return (
      <Empty
        description="未找到该家庭成员"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <Button type="primary" onClick={handleBack}>
          返回列表
        </Button>
      </Empty>
    );
  }

  const getBMIStatus = (bmi) => {
    if (!bmi) return { text: '未知', color: 'default' };
    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) return { text: '偏瘦', color: 'blue' };
    if (bmiValue < 24) return { text: '正常', color: 'green' };
    if (bmiValue < 28) return { text: '偏胖', color: 'orange' };
    return { text: '肥胖', color: 'red' };
  };

  const bmiStatus = getBMIStatus(currentMember.bmi);

  const reportColumns = [
    {
      title: '报告日期',
      dataIndex: 'reportDate',
      key: 'reportDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '医院',
      dataIndex: 'hospitalName',
      key: 'hospitalName'
    },
    {
      title: '医生',
      dataIndex: 'doctorName',
      key: 'doctorName'
    },
    {
      title: '指标数量',
      dataIndex: 'indicatorCount',
      key: 'indicatorCount',
      render: (count) => `${count || 0}项`
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<FileTextOutlined />}
          onClick={() => handleViewReport(record.id)}
        >
          查看详情
        </Button>
      )
    }
  ];

  const medicationColumns = [
    {
      title: '药品名称',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '服用频率',
      dataIndex: 'frequency',
      key: 'frequency',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? '服用中' : '已停用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleEditMedication(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleMedication(record)}
          >
            {record.isActive ? '停用' : '恢复'}
          </Button>
          <Popconfirm
            title="确定删除该用药记录吗？"
            onConfirm={() => handleDeleteMedication(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const getLogTypeTag = (logType) => {
    const typeMap = {
      'report': { color: 'blue', text: '检查报告' },
      'medication': { color: 'green', text: '用药记录' },
      'hospitalization': { color: 'purple', text: '住院治疗' },
      'outpatient': { color: 'cyan', text: '门诊治疗' },
      'emergency': { color: 'red', text: '急诊治疗' }
    };
    return typeMap[logType] || { color: 'default', text: '其他' };
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
            >
              返回
            </Button>
            <span>家庭成员详情</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleEdit}
          >
            编辑信息
          </Button>
        }
      >
        <div style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <Avatar
                  size={120}
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: currentMember.gender === '男' ? '#1890ff' : '#f759ab',
                    fontSize: '48px'
                  }}
                >
                  {currentMember.name.charAt(0)}
                </Avatar>
                <div style={{ marginTop: 16 }}>
                  <h2>{currentMember.name}</h2>
                  <Tag color={currentMember.gender === '男' ? 'blue' : 'pink'} size="large">
                    {currentMember.gender}
                  </Tag>
                </div>
              </div>
            </Col>
            <Col span={18}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="年龄"
                    value={currentMember.age || 0}
                    suffix="岁"
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="身高"
                    value={currentMember.height || 0}
                    suffix="cm"
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="体重"
                    value={currentMember.weight || 0}
                    suffix="kg"
                  />
                </Col>
                <Col span={6}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>BMI</div>
                    <div>
                      <span style={{ fontSize: '24px', fontWeight: 'bold' }}>
                        {currentMember.bmi || '-'}
                      </span>
                      {currentMember.bmi && (
                        <Tag color={bmiStatus.color} style={{ marginLeft: 8 }}>
                          {bmiStatus.text}
                        </Tag>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="基本信息" key="basic" icon={<UserOutlined />}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="姓名">{currentMember.name}</Descriptions.Item>
              <Descriptions.Item label="性别">
                <Tag color={currentMember.gender === '男' ? 'blue' : 'pink'}>
                  {currentMember.gender}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关系">{currentMember.relationship}</Descriptions.Item>
              <Descriptions.Item label="生日">
                {currentMember.birthday ? dayjs(currentMember.birthday).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="年龄">
                {currentMember.age ? `${currentMember.age}岁` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="身高">
                {currentMember.height ? `${currentMember.height}cm` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="体重">
                {currentMember.weight ? `${currentMember.weight}kg` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="BMI">
                {currentMember.bmi ? (
                  <Space>
                    <span>{currentMember.bmi}</span>
                    <Tag color={bmiStatus.color}>{bmiStatus.text}</Tag>
                  </Space>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(currentMember.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间" span={2}>
                {dayjs(currentMember.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </TabPane>

          <TabPane 
            tab={
              <span>
                <MedicineBoxOutlined /> 用药记录
                {medications.filter(m => m.isActive).length > 0 && (
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    {medications.filter(m => m.isActive).length}种
                  </Tag>
                )}
              </span>
            } 
            key="medications"
          >
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddMedication}
              >
                添加用药
              </Button>
            </div>
            <Table
              columns={medicationColumns}
              dataSource={medications}
              rowKey="id"
              loading={medicationsLoading}
              pagination={false}
              locale={{
                emptyText: (
                  <Empty
                    description="暂无用药记录"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Button type="primary" onClick={handleAddMedication}>
                      添加第一个用药记录
                    </Button>
                  </Empty>
                )
              }}
            />
          </TabPane>

          <TabPane tab="医疗报告" key="reports" icon={<FileTextOutlined />}>
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate(`/reports/upload?memberId=${id}`)}
              >
                上传报告
              </Button>
            </div>
            <Table
              columns={reportColumns}
              dataSource={reports.filter(report => report.familyMemberId === parseInt(id))}
              rowKey="id"
              loading={reportsLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 份报告`
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="暂无医疗报告"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )
              }}
            />
          </TabPane>

          <TabPane 
            tab={
              <span>
                <HistoryOutlined /> 医疗日志
              </span>
            } 
            key="logs"
          >
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddMedicalLog}
              >
                添加日志
              </Button>
            </div>
            {logsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin />
              </div>
            ) : medicalLogs.length === 0 ? (
              <Empty
                description="暂无医疗日志"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={handleAddMedicalLog}>
                  添加第一条日志
                </Button>
              </Empty>
            ) : (
              <Timeline
                mode="left"
                items={medicalLogs.map(log => ({
                  color: getLogTypeTag(log.logType).color,
                  label: dayjs(log.treatmentStartDate).format('YYYY-MM-DD HH:mm'),
                  children: (
                    <div key={log.id}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color={getLogTypeTag(log.logType).color}>
                          {getLogTypeTag(log.logType).text}
                        </Tag>
                        <span style={{ fontWeight: 'bold', marginLeft: 8 }}>{log.title}</span>
                        {/* 只有手动类型可以删除 */}
                        {['hospitalization', 'outpatient', 'emergency'].includes(log.logType) && (
                          <Popconfirm
                            title="确定删除该日志吗？"
                            onConfirm={() => handleDeleteMedicalLog(log.id)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button 
                              type="text" 
                              size="small" 
                              danger 
                              icon={<DeleteOutlined />}
                              style={{ marginLeft: 8 }}
                            />
                          </Popconfirm>
                        )}
                      </div>
                      {log.hospital && (
                        <div style={{ color: '#1890ff', marginBottom: 4 }}>
                          就诊医院: {log.hospital}
                        </div>
                      )}
                      {log.treatmentStartDate && log.treatmentEndDate && (
                        <div style={{ color: '#666', marginBottom: 4, fontSize: '12px' }}>
                          治疗时间: {dayjs(log.treatmentStartDate).format('YYYY-MM-DD')} ~ {dayjs(log.treatmentEndDate).format('YYYY-MM-DD')}
                        </div>
                      )}
                      {log.description && (
                        <div style={{ color: '#666', marginBottom: 8 }}>
                          {log.description}
                        </div>
                      )}
                      {log.relatedReport && (
                        <div style={{ color: '#1890ff', fontSize: '12px' }}>
                          关联报告: {log.relatedReport.hospitalName} ({dayjs(log.relatedReport.reportDate).format('YYYY-MM-DD')})
                        </div>
                      )}
                      {log.relatedMedication && (
                        <div style={{ color: '#52c41a', fontSize: '12px' }}>
                          关联用药: {log.relatedMedication.name} {log.relatedMedication.specification}
                        </div>
                      )}
                    </div>
                  )
                }))}
              />
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* 用药记录模态框 */}
      <Modal
        title={editingMedication ? '编辑用药记录' : '添加用药记录'}
        open={medicationModalVisible}
        onCancel={() => {
          setMedicationModalVisible(false);
          medicationForm.resetFields();
          setEditingMedication(null);
        }}
        footer={null}
      >
        <Form
          form={medicationForm}
          layout="vertical"
          onFinish={handleMedicationSubmit}
        >
          <Form.Item
            name="name"
            label="药品名称"
            rules={[{ required: true, message: '请输入药品名称' }]}
          >
            <Input placeholder="请输入药品名称" />
          </Form.Item>
          <Form.Item
            name="specification"
            label="规格"
          >
            <Input placeholder="如: 10mg/片, 5ml/支" />
          </Form.Item>
          <Form.Item
            name="frequency"
            label="服用频率"
          >
            <Select placeholder="请选择或输入频率">
              <Option value="每日一次">每日一次</Option>
              <Option value="每日两次">每日两次</Option>
              <Option value="每日三次">每日三次</Option>
              <Option value="每周一次">每周一次</Option>
              <Option value="必要时服用">必要时服用</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="notes"
            label="备注说明"
          >
            <TextArea rows={3} placeholder="请输入备注说明" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={isCreatingMedication}>
                {editingMedication ? '更新' : '创建'}
              </Button>
              <Button onClick={() => {
                setMedicationModalVisible(false);
                medicationForm.resetFields();
                setEditingMedication(null);
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 医疗日志模态框 */}
      <Modal
        title="添加医疗日志"
        open={medicalLogModalVisible}
        onCancel={() => {
          setMedicalLogModalVisible(false);
          medicalLogForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={medicalLogForm}
          layout="vertical"
          onFinish={handleMedicalLogSubmit}
          initialValues={{ logType: 'outpatient' }}
        >
          <Form.Item
            name="logType"
            label="行为类型"
            rules={[{ required: true, message: '请选择行为类型' }]}
          >
            <Select placeholder="请选择行为类型">
              <Option value="hospitalization">住院治疗</Option>
              <Option value="outpatient">门诊治疗</Option>
              <Option value="emergency">急诊治疗</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="如: 阑尾炎手术、感冒就诊、发烧急诊等" />
          </Form.Item>
          <Form.Item
            name="hospital"
            label="就诊医院"
          >
            <HospitalAutoComplete placeholder="请输入或选择就诊医院" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="treatmentStartDate"
                label="治疗开始时间"
              >
                <DatePicker 
                  showTime 
                  style={{ width: '100%' }} 
                  placeholder="选择开始时间"
                  format="YYYY-MM-DD HH:mm"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="treatmentEndDate"
                label="治疗结束时间"
              >
                <DatePicker 
                  showTime 
                  style={{ width: '100%' }} 
                  placeholder="选择结束时间"
                  format="YYYY-MM-DD HH:mm"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="description"
            label="详细描述"
          >
            <TextArea rows={4} placeholder="请输入详细的医疗行为描述" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={isCreatingLog}>
                创建
              </Button>
              <Button onClick={() => {
                setMedicalLogModalVisible(false);
                medicalLogForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FamilyMemberDetail;
