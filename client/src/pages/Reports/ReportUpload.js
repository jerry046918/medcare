import React, { useState, useEffect } from 'react';
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
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
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
import IndicatorEditTable, { newIndicatorRow, applyIndicatorChange } from '../../components/common/IndicatorEditTable';
import ocrAPI from '../../api/ocrAPI';
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
        setIndicatorData(prev => applyIndicatorChange(prev, indicators, rowId, 'indicatorId', response.data.id));
        message.success(`指标 "${indicatorInfo.name}" 创建成功`);
      }
    } catch (error) {
      message.error(`创建指标失败: ${error.message}`);
    }
  };

  const handleAddIndicator = () => {
    setIndicatorData([...indicatorData, newIndicatorRow()]);
  };

  return (
    <div className="page-fade-in">
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
              style={{
                border: '2px dashed #3b82f6',
                borderRadius: 12,
                background: '#f0f9ff',
                padding: '24px 16px'
              }}
            >
              <p className="ant-upload-drag-icon" style={{ marginBottom: 12 }}>
                <InboxOutlined style={{ fontSize: 48, color: '#3b82f6' }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500, color: '#334155' }}>
                点击或拖拽上传报告文件
              </p>
              <p className="ant-upload-hint" style={{ color: '#64748b' }}>
                支持 JPG / PNG / PDF 等格式，上传后自动识别指标
              </p>
            </Dragger>
          </Form.Item>

          {/* OCR status bar */}
          {ocrStatus !== 'idle' && (
            <Alert
              style={{ marginBottom: 16, borderRadius: 8 }}
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
              maxHeight: 200, overflow: 'auto', background: '#f8fafc',
              padding: 16, borderRadius: 8, fontSize: 12, marginBottom: 16,
              border: '1px solid #e2e8f0', color: '#475569', lineHeight: 1.6
            }}>
              {ocrRawText}
            </pre>
          )}

          {/* Indicator table */}
          <Divider style={{ marginTop: 32, marginBottom: 24 }}>
            <Space>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#334155' }}>指标数据{indicatorData.length > 0 ? ` (${indicatorData.length} 项)` : ''}</span>
              <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAddIndicator}>
                手动添加
              </Button>
            </Space>
          </Divider>

          <IndicatorEditTable
            indicators={indicators}
            value={indicatorData}
            onChange={setIndicatorData}
            onCreateIndicator={handleCreateNewIndicator}
            onAddRow={handleAddIndicator}
            style={{ marginBottom: 24 }}
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
