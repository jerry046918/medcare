import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Form,
  Input,
  DatePicker,
  Select,
  Button,
  Upload,
  Space,
  message,
  Divider,
  Row,
  Col,
  Table,
  Popconfirm,
  Spin,
  Alert,
  Tag
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchReportDetail, updateReport } from '../../store/slices/reportSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';
import { fetchIndicators } from '../../store/slices/indicatorSlice';

const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

const ReportEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  
  const { currentReport, isLoading, isUpdating } = useSelector(state => state.reports);
  const { list: familyMembers } = useSelector(state => state.familyMembers);
  const { list: indicators } = useSelector(state => state.indicators);
  
  const [indicatorData, setIndicatorData] = useState([]);
  const [fileList, setFileList] = useState([]);

  // 自动判断异常状态的函数
  const checkAbnormalStatus = useCallback((indicatorId, value) => {
    if (!indicatorId || !value || !indicators || indicators.length === 0) {
      return { isNormal: null, abnormalType: null };
    }

    const indicator = indicators.find(ind => ind.id === indicatorId);
    if (!indicator) {
      return { isNormal: null, abnormalType: null };
    }

    // 定性指标判断
    if (indicator.valueType === 'qualitative') {
      if (indicator.normalValue) {
        const isNormal = value === indicator.normalValue;
        return {
          isNormal,
          abnormalType: isNormal ? 'normal' : 'abnormal'
        };
      }
      return { isNormal: null, abnormalType: null };
    }

    // 数值型指标判断
    if (indicator.valueType === 'numeric' && indicator.normalMin !== null && indicator.normalMax !== null) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return { isNormal: null, abnormalType: null };
      }

      if (numValue >= indicator.normalMin && numValue <= indicator.normalMax) {
        return { isNormal: true, abnormalType: 'normal' };
      } else if (numValue > indicator.normalMax) {
        return { isNormal: false, abnormalType: 'high' };
      } else {
        return { isNormal: false, abnormalType: 'low' };
      }
    }

    return { isNormal: null, abnormalType: null };
  }, [indicators]);

  useEffect(() => {
    if (id) {
      dispatch(fetchReportDetail(id));
    }
    dispatch(fetchFamilyMembers());
    dispatch(fetchIndicators());
  }, [dispatch, id]);

  useEffect(() => {
    if (currentReport) {
      // 设置表单初始值
      form.setFieldsValue({
        familyMemberId: currentReport.familyMemberId,
        reportDate: dayjs(currentReport.reportDate),
        hospitalName: currentReport.hospitalName,
        doctorName: currentReport.doctorName,
        notes: currentReport.notes
      });
      
      // 设置指标数据
      if (currentReport.indicatorData) {
        const formattedIndicatorData = currentReport.indicatorData.map((item, index) => {
          const baseItem = {
            id: item.id || Date.now() + index,
            indicatorId: item.indicatorId,
            value: item.value,
            referenceRange: item.referenceRange,
            isNormal: item.isNormal,
            abnormalType: item.abnormalType,
            notes: item.notes
          };
          
          return baseItem;
        });
        setIndicatorData(formattedIndicatorData);
      }
    }
  }, [currentReport, form]);

  // 当indicators加载完成后，重新计算指标的异常状态
  useEffect(() => {
    if (indicators && indicators.length > 0 && indicatorData.length > 0) {
      setIndicatorData(prevData => 
        prevData.map(item => {
          // 如果没有异常状态信息或需要重新计算，自动计算
          if (item.indicatorId && item.value && (item.abnormalType === undefined || item.abnormalType === null)) {
            const abnormalStatus = checkAbnormalStatus(item.indicatorId, item.value);
            return { ...item, ...abnormalStatus };
          }
          return item;
        })
      );
    }
  }, [indicators, checkAbnormalStatus]);

  const handleSubmit = async (values) => {
    try {
      const filteredIndicatorData = indicatorData.filter(item => 
        item.indicatorId !== null && 
        item.indicatorId !== undefined &&
        item.value !== undefined && 
        item.value !== '' &&
        item.value !== null
      );
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('原始指标数据:', indicatorData);
        console.log('过滤后指标数据:', filteredIndicatorData);
      }
      
      const reportData = {
        ...values,
        reportDate: values.reportDate.format('YYYY-MM-DD'),
        indicatorData: filteredIndicatorData,
        pdfFile: fileList.length > 0 ? fileList[0] : null
      };
      
      if (process.env.NODE_ENV !== 'production') console.log('提交的报告数据:', reportData);
      
      await dispatch(updateReport({ id, data: reportData })).unwrap();
      message.success('报告更新成功');
      navigate(`/reports/${id}`);
    } catch (error) {
      console.error('更新报告失败:', error);
      // 错误已在Redux中处理
    }
  };

  const handleAddIndicator = () => {
    const newIndicator = {
      id: Date.now(),
      indicatorId: null,
      value: '',
      referenceRange: '',
      isNormal: true,
      notes: ''
    };
    setIndicatorData([...indicatorData, newIndicator]);
  };

  const handleRemoveIndicator = (id) => {
    setIndicatorData(indicatorData.filter(item => item.id !== id));
  };

  const handleIndicatorChange = (id, field, value) => {
    setIndicatorData(prevData => prevData.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // 当检测值或指标ID变化时，自动判断异常状态
        if (field === 'value' || field === 'indicatorId') {
          const indicatorId = field === 'indicatorId' ? value : item.indicatorId;
          const testValue = field === 'value' ? value : item.value;
          
          const abnormalStatus = checkAbnormalStatus(indicatorId, testValue);
          Object.assign(updatedItem, abnormalStatus);
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    fileList,
    beforeUpload: (file) => {
      const isPDF = file.type === 'application/pdf';
      if (!isPDF) {
        message.error('只能上传PDF文件!');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB!');
        return false;
      }
      setFileList([file]);
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setFileList([]);
    }
  };

  const indicatorColumns = [
    {
      title: '指标名称',
      dataIndex: 'indicatorId',
      key: 'indicatorId',
      width: 200,
      render: (value, record) => (
        <Select
          placeholder="选择指标"
          style={{ width: '100%' }}
          value={value || undefined}
          onChange={(val) => {
            handleIndicatorChange(record.id, 'indicatorId', val);
            const indicator = indicators.find(ind => ind.id === val);
            if (indicator) {
              handleIndicatorChange(record.id, 'referenceRange', indicator.referenceRange || '');
            }
          }}
          showSearch
          optionFilterProp="label"
          filterOption={(input, option) =>
            option?.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }
          options={indicators.map(indicator => ({
            value: indicator.id,
            label: `${indicator.name} (${indicator.unit})`
          }))}
        />
      )
    },
    {
      title: '检测值',
      dataIndex: 'value',
      key: 'value',
      width: 120,
      render: (value, record) => {
        const indicator = indicators.find(ind => ind.id === record.indicatorId);
        
        if (indicator?.valueType === 'qualitative') {
          return (
            <Select
              placeholder="选择结果"
              value={value}
              onChange={(val) => handleIndicatorChange(record.id, 'value', val)}
              style={{ width: '100%' }}
            >
              <Option value="positive">阳性</Option>
              <Option value="negative">阴性</Option>
            </Select>
          );
        }
        
        return (
          <Input
            placeholder="输入数值"
            value={value}
            onChange={(e) => handleIndicatorChange(record.id, 'value', e.target.value)}
          />
        );
      }
    },
    {
      title: '参考范围',
      dataIndex: 'referenceRange',
      key: 'referenceRange',
      width: 150,
      render: (value, record) => (
        <Input
          placeholder="如: 3.9-6.1"
          value={value}
          onChange={(e) => handleIndicatorChange(record.id, 'referenceRange', e.target.value)}
        />
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
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
      render: (value, record) => (
        <Input
          placeholder="备注信息"
          value={value}
          onChange={(e) => handleIndicatorChange(record.id, 'notes', e.target.value)}
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确定删除这个指标吗？"
          onConfirm={() => handleRemoveIndicator(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            size="small"
          />
        </Popconfirm>
      )
    }
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!currentReport) {
    return (
      <Alert
        message="报告不存在"
        description="无法找到要编辑的报告"
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

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`/reports/${id}`)}
            >
              返回
            </Button>
            <span>编辑医疗报告</span>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="familyMemberId"
                label="家庭成员"
                rules={[{ required: true, message: '请选择家庭成员' }]}
              >
                <Select placeholder="选择家庭成员">
                  {familyMembers.map(member => (
                    <Option key={member.id} value={member.id}>
                      {member.name} ({member.gender})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reportDate"
                label="报告日期"
                rules={[{ required: true, message: '请选择报告日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="hospitalName"
                label="医院名称"
                rules={[{ required: true, message: '请输入医院名称' }]}
              >
                <Input placeholder="请输入医院名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="doctorName"
                label="医生姓名"
              >
                <Input placeholder="请输入医生姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="备注信息"
          >
            <TextArea
              rows={3}
              placeholder="请输入备注信息"
            />
          </Form.Item>

          <Divider>PDF文件上传</Divider>
          <Form.Item label="报告PDF文件">
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持PDF格式，文件大小不超过10MB
              </p>
            </Dragger>
          </Form.Item>

          <Divider>
            <Space>
              <span>指标数据</span>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="small"
                onClick={handleAddIndicator}
              >
                添加指标
              </Button>
            </Space>
          </Divider>

          <Table
            columns={indicatorColumns}
            dataSource={indicatorData}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 24 }}
            locale={{
              emptyText: (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p>暂无指标数据</p>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={handleAddIndicator}
                  >
                    添加第一个指标
                  </Button>
                </div>
              )
            }}
          />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isUpdating}
                size="large"
              >
                更新报告
              </Button>
              <Button
                size="large"
                onClick={() => navigate(`/reports/${id}`)}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ReportEdit;