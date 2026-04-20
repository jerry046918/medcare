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
  Table,
  Popconfirm,
  Tag,
  Alert,
  Modal
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  InboxOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RedoOutlined
} from '@ant-design/icons';
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
  const [reportFile, setReportFile] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState(null);
  const [ocrRawText, setOcrRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        reportFile: reportFile
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

  const handleFileSelect = async (file) => {
    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isValidType) {
      message.error('仅支持图片和PDF文件');
      return false;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超过10MB');
      return false;
    }

    setReportFile(file);
    setOcrStatus('recognizing');
    setOcrError(null);
    setOcrRawText('');

    try {
      const response = await ocrAPI.recognizeAndParse(file);
      if (response.success && response.data) {
        setOcrStatus('success');
        setOcrResult(response.data);
        setOcrRawText(response.data.ocr?.text || '');

        if (response.data.indicators && response.data.indicators.length > 0) {
          populateIndicatorsFromOCR(response.data.indicators);
        }
      } else {
        setOcrStatus('error');
        setOcrError(response.message || 'OCR识别失败');
      }
    } catch (error) {
      setOcrStatus('error');
      setOcrError(error.response?.data?.message || error.message || 'OCR识别失败');
    }

    return false;
  };

  const populateIndicatorsFromOCR = (parsedIndicators) => {
    const newItems = [];

    for (let i = 0; i < parsedIndicators.length; i++) {
      const item = parsedIndicators[i];
      newItems.push({
        id: Date.now() + i,
        indicatorId: item.indicatorId || null,
        value: item.value || '',
        referenceRange: item.referenceRange || '',
        isNormal: item.isNormal !== undefined ? item.isNormal : null,
        abnormalType: item.abnormalType || 'normal',
        notes: item.notes || '',
        ocrMatched: !!item.indicatorId,
        ocrName: item.name || ''
      });
    }

    setIndicatorData(prev => [...prev, ...newItems]);
    const matched = newItems.filter(i => i.ocrMatched).length;
    const unmatched = newItems.filter(i => !i.ocrMatched).length;
    message.success(`识别出 ${newItems.length} 个指标（${matched} 个已匹配，${unmatched} 个待确认）`);
  };

  const handleCreateNewIndicator = async (rowId, indicatorInfo) => {
    try {
      const response = await ocrAPI.createIndicator({
        name: indicatorInfo.name,
        unit: indicatorInfo.unit || '',
        type: indicatorInfo.type || '血液',
        valueType: 'numeric',
        normalMin: indicatorInfo.normalMin,
        normalMax: indicatorInfo.normalMax,
        referenceRange: indicatorInfo.normalMin && indicatorInfo.normalMax
          ? `${indicatorInfo.normalMin}-${indicatorInfo.normalMax}`
          : '',
        isDefault: false
      });

      if (response.success && response.data) {
        dispatch(fetchIndicators());
        handleIndicatorChange(rowId, 'indicatorId', response.data.id);
        message.success(`指标 "${indicatorInfo.name}" 创建成功`);
      }
    } catch (error) {
      message.error(`创建指标失败: ${error.message}`);
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

  const indicatorColumns = [
    {
      title: '指标名称',
      dataIndex: 'indicatorId',
      key: 'indicatorId',
      width: 240,
      render: (value, record) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Select
            placeholder="选择指标"
            style={{ width: '100%' }}
            value={value || undefined}
            status={record.ocrMatched === false && !value ? 'warning' : undefined}
            onChange={(val) => {
              handleIndicatorChange(record.id, 'indicatorId', val);
              const indicator = indicators.find(ind => ind.id === val);
              if (indicator) {
                handleIndicatorChange(record.id, 'referenceRange', indicator.referenceRange || '');
              }
              setIndicatorData(prev => prev.map(item =>
                item.id === record.id ? { ...item, ocrMatched: true } : item
              ));
              if (record.ocrName) {
                ocrAPI.confirmMatch(val, record.ocrName).catch(() => {});
              }
            }}
            showSearch
            optionFilterProp="label"
            filterOption={(input, option) =>
              option?.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '4px 0' }} />
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  style={{ padding: '4px 8px', width: '100%', textAlign: 'left' }}
                  onClick={() => {
                    Modal.confirm({
                      title: '新建指标',
                      content: `将创建指标 "${record.ocrName || '未命名'}"`,
                      onOk: () => handleCreateNewIndicator(record.id, {
                        name: record.ocrName || '',
                        unit: record.ocrUnit || '',
                      })
                    });
                  }}
                >
                  新建指标...
                </Button>
              </>
            )}
            options={indicators.map(indicator => ({
              value: indicator.id,
              label: `${indicator.name} (${indicator.unit})`
            }))}
          />
          {record.ocrMatched === false && !value && (
            <Tag color="orange" style={{ fontSize: 11 }}>待确认: {record.ocrName}</Tag>
          )}
        </Space>
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
            <Select placeholder="选择结果" value={value}
              onChange={(val) => handleIndicatorChange(record.id, 'value', val)}
              style={{ width: '100%' }}>
              <Option value="positive">阳性</Option>
              <Option value="negative">阴性</Option>
            </Select>
          );
        }
        return (
          <Input placeholder="输入数值" value={value}
            onChange={(e) => handleIndicatorChange(record.id, 'value', e.target.value)} />
        );
      }
    },
    {
      title: '参考范围',
      dataIndex: 'referenceRange',
      key: 'referenceRange',
      width: 150,
      render: (value, record) => (
        <Input placeholder="如: 3.9-6.1" value={value}
          onChange={(e) => handleIndicatorChange(record.id, 'referenceRange', e.target.value)} />
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const { isNormal, abnormalType } = record;
        if (isNormal === true || abnormalType === 'normal') return <Tag color="green">正常</Tag>;
        if (abnormalType === 'high') return <Tag color="red">偏高</Tag>;
        if (abnormalType === 'low') return <Tag color="orange">偏低</Tag>;
        if (abnormalType === 'abnormal') return <Tag color="red">异常</Tag>;
        if (isNormal === false) return <Tag color="red">异常</Tag>;
        return <Tag color="default">未判断</Tag>;
      }
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      render: (value, record) => (
        <Input placeholder="备注信息" value={value}
          onChange={(e) => handleIndicatorChange(record.id, 'notes', e.target.value)} />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="确定删除这个指标吗？" onConfirm={() => handleRemoveIndicator(record.id)}
          okText="确定" cancelText="取消">
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      )
    }
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>
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
          initialValues={{ reportDate: dayjs() }}
        >
          {/* Basic info */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="familyMemberId" label="家庭成员"
                rules={[{ required: true, message: '请选择家庭成员' }]}>
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
              <Form.Item name="reportDate" label="报告日期"
                rules={[{ required: true, message: '请选择报告日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="hospitalName" label="医院名称"
                rules={[{ required: true, message: '请输入医院名称' }]}>
                <HospitalAutoComplete placeholder="请输入或选择医院" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="doctorName" label="医生姓名">
                <Input placeholder="请输入医生姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="备注信息">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>

          {/* Unified upload + auto OCR */}
          <Divider>报告附件（上传后自动识别）</Divider>
          <Form.Item label="报告文件">
            <Dragger
              name="file"
              multiple={false}
              fileList={reportFile ? [{ uid: '-1', name: reportFile.name, status: 'done' }] : []}
              beforeUpload={(file) => handleFileSelect(file)}
              onRemove={() => {
                setReportFile(null);
                setOcrStatus('idle');
                setOcrResult(null);
              }}
              accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf"
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽上传报告文件</p>
              <p className="ant-upload-hint">支持 JPG / PNG / PDF 等格式，上传后自动识别指标</p>
            </Dragger>
          </Form.Item>

          {/* OCR status bar */}
          {ocrStatus !== 'idle' && (
            <Alert
              style={{ marginBottom: 16 }}
              type={ocrStatus === 'recognizing' ? 'info' : ocrStatus === 'success' ? 'success' : 'error'}
              showIcon
              icon={
                ocrStatus === 'recognizing' ? <LoadingOutlined spin /> :
                ocrStatus === 'success' ? <CheckCircleOutlined /> :
                <CloseCircleOutlined />
              }
              message={
                ocrStatus === 'recognizing' ? '正在识别报告内容...' :
                ocrStatus === 'success' ? `识别完成` :
                `识别失败: ${ocrError}`
              }
              description={
                ocrStatus === 'success' ? (
                  <Space size="small">
                    <Button size="small" type="link" onClick={() => setShowRawText(!showRawText)}>
                      {showRawText ? '隐藏原始文本' : '查看原始文本'}
                    </Button>
                    <Button size="small" type="link" icon={<RedoOutlined />}
                      onClick={() => handleFileSelect(reportFile)}>
                      重新识别
                    </Button>
                  </Space>
                ) : ocrStatus === 'error' ? (
                  <Button size="small" type="link"
                    onClick={() => handleFileSelect(reportFile)}>
                    重试
                  </Button>
                ) : null
              }
            />
          )}
          {showRawText && ocrRawText && (
            <pre style={{
              maxHeight: 200, overflow: 'auto', background: '#f5f5f5',
              padding: 12, borderRadius: 4, fontSize: 12, marginBottom: 16
            }}>
              {ocrRawText}
            </pre>
          )}

          {/* Indicator table */}
          <Divider>
            <Space>
              <span>指标数据{indicatorData.length > 0 ? ` (${indicatorData.length} 项)` : ''}</span>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddIndicator}>
                手动添加
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
                  <p>暂无指标数据，请上传报告自动识别或手动添加</p>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddIndicator}>
                    添加第一个指标
                  </Button>
                </div>
              )
            }}
          />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit"
                loading={isCreating || isSubmitting} disabled={isSubmitting} size="large">
                提交报告
              </Button>
              <Button size="large" onClick={() => navigate('/reports')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ReportUpload;
