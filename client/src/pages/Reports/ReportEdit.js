import React, { useState, useEffect } from 'react';
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
  Spin,
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  InboxOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RedoOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchReportDetail, updateReport } from '../../store/slices/reportSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';
import { fetchIndicators } from '../../store/slices/indicatorSlice';
import IndicatorEditTable, { newIndicatorRow, applyIndicatorChange, checkAbnormalStatus } from '../../components/common/IndicatorEditTable';
import ocrAPI from '../../api/ocrAPI';

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
  const [reportFile, setReportFile] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrError, setOcrError] = useState(null);
  const [ocrRawText, setOcrRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);

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
            const abnormalStatus = checkAbnormalStatus(indicators, item.indicatorId, item.value);
            return { ...item, ...abnormalStatus };
          }
          return item;
        })
      );
    }
  }, [indicators, checkAbnormalStatus]);

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
        reportFile: reportFile
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
    setIndicatorData([...indicatorData, newIndicatorRow()]);
  };

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
    <div className="page-fade-in">
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

          {/* Unified upload + auto OCR */}
          <Divider>报告附件（上传新文件自动识别）</Divider>
          <Form.Item label="报告文件">
            {currentReport?.filePath && !reportFile && (
              <div style={{
                marginBottom: 12, padding: '10px 16px',
                background: '#f0f9ff', borderRadius: 8,
                border: '1px solid #bae6fd', color: '#334155'
              }}>
                <Space>
                  <FileTextOutlined style={{ color: '#3b82f6' }} />
                  <span>当前附件: {currentReport.fileName || '已上传文件'}</span>
                  <Button size="small" type="link" onClick={() => setReportFile(null)}>
                    保留
                  </Button>
                </Space>
              </div>
            )}
            <Dragger
              name="file"
              multiple={false}
              fileList={reportFile ? [{ uid: '-1', name: reportFile.name, status: 'done' }] : []}
              beforeUpload={(file) => handleFileSelect(file)}
              onRemove={() => {
                setReportFile(null);
                setOcrStatus('idle');
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
                点击或拖拽上传新报告文件
              </p>
              <p className="ant-upload-hint" style={{ color: '#64748b' }}>
                替换现有附件，上传后自动识别指标
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
                ocrStatus === 'success' ? '识别完成' :
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
                  <Button size="small" type="link" onClick={() => handleFileSelect(reportFile)}>
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
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="small"
                onClick={handleAddIndicator}
              >
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
