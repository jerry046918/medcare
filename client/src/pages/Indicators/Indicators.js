import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Empty,
  Descriptions,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { fetchIndicators, createIndicator, updateIndicator, deleteIndicator, clearError } from '../../store/slices/indicatorSlice';

const { Option } = Select;
const { TextArea } = Input;

const Indicators = () => {
  const dispatch = useDispatch();
  const { list, isLoading, isCreating, isUpdating, isDeleting, error } = useSelector(state => state.indicators);
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState(null);
  const [viewingIndicator, setViewingIndicator] = useState(null);
  const [filters, setFilters] = useState({
    name: '',
    type: '',
    isDefault: null
  });
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchIndicators());
  }, [dispatch]);

  const handleValueTypeChange = (value) => {
    // 当值类型改变时，清除相关字段
    if (value === 'numeric') {
      form.setFieldsValue({ normalValue: undefined });
    } else if (value === 'qualitative') {
      form.setFieldsValue({ normalMin: undefined, normalMax: undefined });
    }
  };

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleAdd = () => {
    setEditingIndicator(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (indicator) => {
    setEditingIndicator(indicator);
    form.setFieldsValue(indicator);
    setIsModalVisible(true);
  };

  const handleView = (indicator) => {
    setViewingIndicator(indicator);
    setIsDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteIndicator(id)).unwrap();
      message.success('删除成功');
    } catch (error) {
      // 错误已在Redux中处理
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingIndicator) {
        await dispatch(updateIndicator({ id: editingIndicator.id, data: values })).unwrap();
        message.success('更新成功');
      } else {
        await dispatch(createIndicator(values)).unwrap();
        message.success('创建成功');
      }
      
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      // 错误已在Redux中处理
    }
  };

  // 过滤数据
  const filteredData = list.filter(indicator => {
    if (filters.name && !indicator.name.toLowerCase().includes(filters.name.toLowerCase())) {
      return false;
    }
    if (filters.type && indicator.type !== filters.type) {
      return false;
    }
    if (filters.isDefault !== null && indicator.isDefault !== filters.isDefault) {
      return false;
    }
    return true;
  });

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

  const columns = [
    {
      title: '指标名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: record.isDefault ? 'bold' : 'normal' }}>
            {text}
          </span>
          {record.isDefault && <Tag color="blue">默认</Tag>}
        </Space>
      )
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      render: (unit) => unit || '-'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeInfo = indicatorTypes.find(t => t.value === type);
        return (
          <Tag color="geekblue">
            {typeInfo ? typeInfo.label : type}
          </Tag>
        );
      }
    },
    {
      title: '值类型',
      dataIndex: 'valueType',
      key: 'valueType',
      render: (valueType) => {
        if (valueType === 'numeric') {
          return <Tag color="green">数值型</Tag>;
        } else if (valueType === 'qualitative') {
          return <Tag color="orange">定性型</Tag>;
        }
        return <Tag color="default">未设置</Tag>;
      }
    },
    {
      title: '测试方法',
      dataIndex: 'testMethod',
      key: 'testMethod',
      render: (method) => method || '-'
    },
    {
      title: '正常范围',
      key: 'normalRange',
      render: (_, record) => {
        if (record.valueType === 'numeric') {
          if (record.normalMin !== null && record.normalMax !== null) {
            return `${record.normalMin} - ${record.normalMax}`;
          }
        } else if (record.valueType === 'qualitative') {
          if (record.normalValue) {
            return record.normalValue === 'positive' ? '阳性' : '阴性';
          }
        }
        return '-';
      }
    },
    {
      title: '参考范围（文本）',
      dataIndex: 'referenceRange',
      key: 'referenceRange',
      render: (range) => range || '-'
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => (
        <Space>
          <Tag color={record.isDefault ? 'blue' : 'default'}>
            {record.isDefault ? '系统默认' : '自定义'}
          </Tag>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleView(record)}
          >
            详情
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {!record.isDefault && (
            <Popconfirm
              title="确定要删除这个指标吗？"
              description="删除后无法恢复，且会影响相关的报告数据。"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={isDeleting}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="健康指标管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加指标
          </Button>
        }
      >
        {/* 筛选器 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索指标名称"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              value={filters.name}
              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
              allowClear
            />
            
            <Select
              placeholder="选择类型"
              style={{ width: 150 }}
              allowClear
              value={filters.type}
              onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
            >
              {indicatorTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
            
            <Select
              placeholder="选择状态"
              style={{ width: 120 }}
              allowClear
              value={filters.isDefault}
              onChange={(value) => setFilters(prev => ({ ...prev, isDefault: value }))}
            >
              <Option value={true}>系统默认</Option>
              <Option value={false}>自定义</Option>
            </Select>
          </Space>
        </div>

        {filteredData.length === 0 && !isLoading ? (
          <Empty
            description="暂无健康指标"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" icon={<BarChartOutlined />} onClick={handleAdd}>
              添加第一个指标
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

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingIndicator ? '编辑健康指标' : '添加健康指标'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="指标名称"
            rules={[{ required: true, message: '请输入指标名称' }]}
          >
            <Input placeholder="请输入指标名称" />
          </Form.Item>

          <Form.Item
            name="unit"
            label="单位"
          >
            <Input placeholder="请输入单位，如：mg/dL, mmol/L" />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择指标类型' }]}
          >
            <Select placeholder="请选择指标类型">
              {indicatorTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
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

          <Form.Item
            name="testMethod"
            label="测试方法"
          >
            <Input placeholder="请输入测试方法" />
          </Form.Item>

          <Form.Item
            name="referenceRange"
            label="参考范围（文本描述）"
          >
            <Input placeholder="请输入参考范围，如：3.5-5.0" />
          </Form.Item>

          {/* 数值型指标的正常范围 */}
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
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder="请输入最小值"
                          precision={2}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="normalMax"
                        label="最大正常值"
                        rules={[{ required: true, message: '请输入最大正常值' }]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder="请输入最大值"
                          precision={2}
                        />
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

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea
              rows={3}
              placeholder="请输入指标描述"
            />
          </Form.Item>

          <Form.Item
            name="isDefault"
            label="设为默认指标"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isCreating || isUpdating}
              >
                {editingIndicator ? '更新' : '创建'}
              </Button>
              <Button
                onClick={() => {
                  setIsModalVisible(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情模态框 */}
      <Modal
        title="指标详情"
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
            关闭
          </Button>
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
              {viewingIndicator.valueType === 'numeric' && viewingIndicator.normalMin !== null && viewingIndicator.normalMax !== null ? (
                `${viewingIndicator.normalMin} - ${viewingIndicator.normalMax}`
              ) : viewingIndicator.valueType === 'qualitative' && viewingIndicator.normalValue ? (
                viewingIndicator.normalValue === 'positive' ? '阳性' : '阴性'
              ) : (
                '-'
              )}
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

export default Indicators;