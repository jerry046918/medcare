import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  InputNumber,
  Table,
  Popconfirm,
  Tag
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
  InboxOutlined,
  ScanOutlined,
  RobotOutlined
} from '@ant-design/icons';
import OCRReportRecognition from '../../components/OCRReportRecognition';
import dayjs from 'dayjs';
import { createReport } from '../../store/slices/reportSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';
import { fetchIndicators } from '../../store/slices/indicatorSlice';
import HospitalAutoComplete from '../../components/common/HospitalAutoComplete';
import ocrAPI from '../../services/ocrAPI';
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

const ReportUpload = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  
  const { isCreating } = useSelector(state => state.reports);
  const { list: familyMembers } = useSelector(state => state.familyMembers);
  const { list: indicators } = useSelector(state => state.indicators);
  
  const [indicatorData, setIndicatorData] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 防止重复提交
  // 从URL参数获取预选的成员ID
  const preselectedMemberId = searchParams.get('memberId');

  useEffect(() => {
    dispatch(fetchFamilyMembers());
    dispatch(fetchIndicators());
  }, [dispatch]);

  // 当家庭成员列表加载完成后，如果URL中有预选成员ID，则设置表单值
  useEffect(() => {
    if (preselectedMemberId && familyMembers.length > 0) {
      const memberId = parseInt(preselectedMemberId);
      const memberExists = familyMembers.some(m => m.id === memberId);
      if (memberExists) {
        form.setFieldsValue({ familyMemberId: memberId });
      }
    }
  }, [preselectedMemberId, familyMembers, form]);

  const handleSubmit = async (values) => {
    // 防止重复提交
    if (isSubmitting) {
      if (process.env.NODE_ENV !== 'production') console.log('[ReportUpload] 已在提交中，跳过重复请求');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('=== 前端创建报告调试信息 ===');
        console.log('表单数据:', values);
        console.log('可用指标列表:', indicators);
        console.log('可用指标数量:', indicators.length);
        console.log('原始指标数据:', indicatorData);
        console.log('指标数据长度:', indicatorData.length);
      }
      
      const filteredIndicatorData = indicatorData.filter(item => 
        item.indicatorId !== null && 
        item.indicatorId !== undefined &&
        item.value !== undefined && 
        item.value !== '' &&
        item.value !== null
      );
      
      // 检查是否有数据被过滤掉
      if (indicatorData.length > 0 && filteredIndicatorData.length === 0) {
        message.warning('指标数据未完整填写，所有指标均未选择或未填写数值，将不包含指标数据');
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('过滤后指标数据:', filteredIndicatorData);
        console.log('过滤后指标数据长度:', filteredIndicatorData.length);
      }
      
      const reportData = {
        ...values,
        reportDate: values.reportDate.format('YYYY-MM-DD'),
        indicatorData: filteredIndicatorData,
        pdfFile: fileList.length > 0 ? fileList[0] : null
      };
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('最终提交的报告数据:', JSON.stringify(reportData, null, 2));
        console.log('=== 调试信息结束 ===');
      }
      await dispatch(createReport(reportData)).unwrap();
      message.success('报告上传成功');
      // 如果是从成员详情页跳转来的，返回成员详情页
      if (preselectedMemberId) {
        navigate(`/family-members/${preselectedMemberId}`);
      } else {
        navigate('/reports');
      }
    } catch (error) {
      console.error('创建报告失败:', error);
      console.error('错误详情:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      // 显示错误消息给用户
      let errorMsg = '创建报告失败，请稍后重试';
      if (typeof error === 'string') {
        errorMsg = error;
      } else if (error?.message) {
        errorMsg = error.message;
      } else if (error?.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      message.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // OCR 识别回调
  const handleOCRConfirm = async (ocrIndicatorData, selectedIndicators) => {
    if (!ocrIndicatorData || ocrIndicatorData.length === 0) {
      setOcrModalVisible(false);
      return;
    }

    const newIndicatorData = [];
    let newIndicatorCount = 0;

    for (let i = 0; i < ocrIndicatorData.length; i++) {
      const item = ocrIndicatorData[i];
      let indicatorId = item.indicatorId;

      // 处理新建指标
      if (item.newIndicatorInfo) {
        try {
          console.log('[OCR] 创建新指标:', item.newIndicatorInfo.name);
          
          // 调用后端 API 创建新指标
          const response = await ocrAPI.createIndicator({
            name: item.newIndicatorInfo.name,
            unit: item.newIndicatorInfo.unit || '',
            type: item.newIndicatorInfo.type || '血液',
            valueType: item.newIndicatorInfo.valueType || 'numeric',
            normalMin: item.newIndicatorInfo.normalMin,
            normalMax: item.newIndicatorInfo.normalMax,
            referenceRange: item.newIndicatorInfo.normalMin && item.newIndicatorInfo.normalMax
              ? `${item.newIndicatorInfo.normalMin}-${item.newIndicatorInfo.normalMax}`
              : '',
            isDefault: false
          });

          if (response.success && response.data) {
            indicatorId = response.data.id;
            newIndicatorCount++;
            console.log('[OCR] 新指标创建成功:', response.data.name, 'ID:', indicatorId);
            
            // 刷新指标列表以包含新创建的指标
            dispatch(fetchIndicators());
          } else {
            console.error('[OCR] 创建指标失败:', response);
            message.warning(`指标 "${item.newIndicatorInfo.name}" 创建失败，请手动添加`);
            continue; // 跳过这个指标
          }
        } catch (error) {
          console.error('[OCR] 创建指标异常:', error);
          message.warning(`指标 "${item.newIndicatorInfo.name}" 创建异常，请手动添加`);
          continue; // 跳过这个指标
        }
      }

      // 只有有有效 indicatorId 的才添加到列表
      if (indicatorId) {
        newIndicatorData.push({
          id: Date.now() + i,
          indicatorId: indicatorId,
          value: item.value || '',
          referenceRange: item.referenceRange || '',
          isNormal: item.isNormal !== undefined ? item.isNormal : true,
          abnormalType: item.abnormalType || 'normal',
          notes: item.notes || ''
        });
      }
    }

    if (newIndicatorData.length > 0) {
      setIndicatorData(prev => {
        const updated = [...prev, ...newIndicatorData];
        console.log('[OCR] 更新后的 indicatorData:', updated);
        console.log('[OCR] indicatorId 检查:', updated.map(d => ({ id: d.id, indicatorId: d.indicatorId, value: d.value })));
        return updated;
      });
      
      let successMsg = `成功导入 ${newIndicatorData.length} 项指标`;
      if (newIndicatorCount > 0) {
        successMsg += ` (其中 ${newIndicatorCount} 项为新创建)`;
      }
      message.success(successMsg);
    } else if (ocrIndicatorData.length > 0) {
      message.warning('没有有效的指标数据被导入，请检查指标是否正确选择');
      console.warn('[OCR] 所有指标都被跳过，原始数据:', ocrIndicatorData);
    }
    setOcrModalVisible(false);
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

  // 自动判断异常状态的函数
  const checkAbnormalStatus = useCallback((indicatorId, value) => {
    if (!indicatorId || !value) {
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

  const handleIndicatorChange = (id, field, value) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('=== handleIndicatorChange 调试 ===');
      console.log('id:', id, 'field:', field, 'value:', value);
    }

    setIndicatorData(prevData => {
      if (process.env.NODE_ENV !== 'production') console.log('当前indicatorData:', prevData);
      
      const newData = prevData.map(item => {
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
      });
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('更新后的indicatorData:', newData);
        console.log('=== 调试结束 ===');
      }
      
      return newData;
    });
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

  return (
    <div>
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
            <span>上传医疗报告</span>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            reportDate: dayjs()
          }}
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
                <HospitalAutoComplete placeholder="请输入或选择医院" />
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
                icon={<ScanOutlined />}
                onClick={() => setOcrModalVisible(true)}
              >
                OCR 识别
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
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
                loading={isCreating || isSubmitting}
                disabled={isSubmitting}
                size="large"
              >
                提交报告
              </Button>
              <Button
                size="large"
                onClick={() => navigate('/reports')}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* OCR 识别弹窗 */}
      <OCRReportRecognition
        visible={ocrModalVisible}
        onCancel={() => setOcrModalVisible(false)}
        onConfirm={handleOCRConfirm}
        indicators={indicators}
      />
    </div>
  );
};

export default ReportUpload;