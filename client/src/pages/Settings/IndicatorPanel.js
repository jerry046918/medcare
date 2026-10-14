import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Button,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message
} from 'antd';
import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { fetchIndicators, createIndicator, updateIndicator, deleteIndicator, clearError } from '../../store/slices/indicatorSlice';

const { Option } = Select;
const { TextArea } = Input;

// 指标库管理面板：自 v1 Settings 的「指标管理」Tab 原样迁移（/api/indicators CRUD 在 v2 未变）
const IndicatorPanel = () => {
  const dispatch = useDispatch();
  const { list: indicators, isLoading, isCreating, isUpdating, isDeleting, error } = useSelector(state => state.indicators);

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
      indicatorForm.setFieldsValue({
        normalMin: undefined,
        normalMax: undefined,
        normalMinFemale: undefined,
        normalMaxFemale: undefined
      });
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
        if (record.valueType === 'numeric') {
          const parts = [];
          if (record.normalMin !== null || record.normalMax !== null) {
            if (record.normalMin !== null && record.normalMax !== null) {
              parts.push(`${record.normalMin} - ${record.normalMax}`);
            } else if (record.normalMin !== null) {
              parts.push(`≥ ${record.normalMin}`);
            } else {
              parts.push(`≤ ${record.normalMax}`);
            }
          }
          if (record.normalMinFemale !== null || record.normalMaxFemale !== null) {
            let femaleRange = '';
            if (record.normalMinFemale !== null && record.normalMaxFemale !== null) {
              femaleRange = `${record.normalMinFemale} - ${record.normalMaxFemale}`;
            } else if (record.normalMinFemale !== null) {
              femaleRange = `≥ ${record.normalMinFemale}`;
            } else {
              femaleRange = `≤ ${record.normalMaxFemale}`;
            }
            parts.push(`女: ${femaleRange}`);
          }
          return parts.length > 0 ? parts.join(', 男: ') : '-';
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

  return (
    <>
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
                  <div style={{ marginBottom: 8, color: '#1890ff', fontWeight: 'bold', padding: '8px', background: '#e6f7ff', borderRadius: '4px' }}>
                    至少填写最小值或最大值其中之一。如需区分性别，可填写女性专用范围。
                  </div>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="normalMin"
                        label="最小正常值（通用/男性）"
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="无下限" precision={6} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="normalMax"
                        label="最大正常值（通用/男性）"
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="无上限" precision={6} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <div style={{ marginTop: 8, marginBottom: 8, fontWeight: 500 }}>
                    女性专用范围（可选）
                  </div>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="normalMinFemale"
                        label="女性最小正常值"
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="与通用值相同" precision={6} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="normalMaxFemale"
                        label="女性最大正常值"
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="与通用值相同" precision={6} />
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
              {viewingIndicator.valueType === 'numeric' ? (
                (() => {
                  const parts = [];
                  if (viewingIndicator.normalMin !== null || viewingIndicator.normalMax !== null) {
                    if (viewingIndicator.normalMin !== null && viewingIndicator.normalMax !== null) {
                      parts.push(`通用/男性: ${viewingIndicator.normalMin} - ${viewingIndicator.normalMax}`);
                    } else if (viewingIndicator.normalMin !== null) {
                      parts.push(`通用/男性: ≥ ${viewingIndicator.normalMin}`);
                    } else {
                      parts.push(`通用/男性: ≤ ${viewingIndicator.normalMax}`);
                    }
                  }
                  if (viewingIndicator.normalMinFemale !== null || viewingIndicator.normalMaxFemale !== null) {
                    if (viewingIndicator.normalMinFemale !== null && viewingIndicator.normalMaxFemale !== null) {
                      parts.push(`女性: ${viewingIndicator.normalMinFemale} - ${viewingIndicator.normalMaxFemale}`);
                    } else if (viewingIndicator.normalMinFemale !== null) {
                      parts.push(`女性: ≥ ${viewingIndicator.normalMinFemale}`);
                    } else {
                      parts.push(`女性: ≤ ${viewingIndicator.normalMaxFemale}`);
                    }
                  }
                  return parts.length > 0 ? parts.join('；') : '-';
                })()
              ) : viewingIndicator.valueType === 'qualitative' && viewingIndicator.normalValue
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
    </>
  );
};

export default IndicatorPanel;
