import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Button,
  Steps,
  Table,
  Select,
  Input,
  Tag,
  Space,
  Alert,
  Spin,
  Typography,
  Divider,
  message,
  Popconfirm,
  Card
} from 'antd';
import {
  UploadOutlined,
  ScanOutlined,
  CheckOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  FileImageOutlined,
  RobotOutlined,
  EyeOutlined
} from '@ant-design/icons';
import ocrAPI from '../services/ocrAPI';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

/**
 * OCR 报告识别组件
 * 用于上传图片、识别文字、解析指标并匹配指标库
 */
const OCRReportRecognition = ({ visible, onCancel, onConfirm, indicators }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [parsedIndicators, setParsedIndicators] = useState([]);
  const [selectedEngine, setSelectedEngine] = useState(null);

  // 步骤定义
  const steps = [
    { title: '上传图片', icon: <FileImageOutlined /> },
    { title: 'OCR 识别', icon: <RobotOutlined /> },
    { title: '确认指标', icon: <CheckOutlined /> }
  ];

  // 文件上传配置
  const uploadProps = {
    name: 'image',
    multiple: false,
    fileList,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('图片大小不能超过 10MB!');
        return false;
      }
      setFileList([file]);
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setFileList([]);
    }
  };

  // 执行 OCR 识别
  const handleRecognize = async () => {
    if (fileList.length === 0) {
      message.warning('请先上传报告图片');
      return;
    }

    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', fileList[0]);
      if (selectedEngine) {
        formData.append('engine', selectedEngine);
      }

      const response = await ocrAPI.recognizeAndParse(fileList[0], selectedEngine);
      
      if (response.success) {
        setOcrResult(response.data.ocr);
        setParsedIndicators(response.data.indicators.indicators.map((item, index) => ({
          ...item,
          key: index,
          selected: !!item.matched, // 默认选中已匹配的
          customIndicatorId: item.matched?.id || null,
          customValue: item.extracted?.value || '',
          isNewIndicator: false
        })));
        setCurrentStep(2);
        message.success(`识别完成，共发现 ${response.data.indicators.total} 个指标`);
      }
    } catch (error) {
      console.error('OCR 识别失败:', error);
      message.error('OCR 识别失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setOcrLoading(false);
    }
  };

  // 处理指标选择变更
  const handleIndicatorSelect = (key, field, value) => {
    setParsedIndicators(prev => 
      prev.map(item => 
        item.key === key 
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  // 切换指标选中状态
  const toggleIndicatorSelection = (key) => {
    setParsedIndicators(prev =>
      prev.map(item =>
        item.key === key
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  };

  // 标记为新建指标
  const markAsNewIndicator = (key) => {
    setParsedIndicators(prev =>
      prev.map(item =>
        item.key === key
          ? { ...item, isNewIndicator: true, selected: true }
          : item
      )
    );
  };

  // 确认选择的指标
  const handleConfirm = async () => {
    const selectedIndicators = parsedIndicators.filter(item => item.selected);
    
    if (selectedIndicators.length === 0) {
      message.warning('请至少选择一个指标');
      return;
    }

    // 学习别名：对于用户手动选择的指标，自动将 OCR 识别名称添加为别名
    const aliasLearningPromises = [];
    for (const item of selectedIndicators) {
      // 只对非新建指标且原本未自动匹配的情况学习别名
      if (!item.isNewIndicator && item.customIndicatorId && !item.matched) {
        aliasLearningPromises.push(
          ocrAPI.confirmMatch(
            item.customIndicatorId,
            item.extracted?.name,
            true
          ).catch(err => {
            // 别名学习失败不影响主流程，只记录日志
            console.warn('学习别名失败:', err);
          })
        );
      }
    }

    // 并行执行别名学习（不阻塞主流程）
    if (aliasLearningPromises.length > 0) {
      Promise.all(aliasLearningPromises).then(results => {
        const learned = results.filter(r => r?.data?.aliasAdded).length;
        if (learned > 0) {
          console.log(`[OCR] 成功学习 ${learned} 个新别名`);
        }
      });
    }

    // 准备数据
    // 【重要】对于已匹配的指标，referenceRange/isNormal/abnormalType 以指标库为准
    // 对于新建指标，使用 OCR 识别的数据作为新指标的初始值
    const rawIndicatorData = selectedIndicators.map(item => {
      // 已匹配指标：使用指标库的数据
      // 新建指标：使用 OCR 识别的数据
      const isMatched = !item.isNewIndicator && item.customIndicatorId && item.indicatorData;
      
      return {
        indicatorId: item.isNewIndicator ? null : item.customIndicatorId,
        value: item.customValue || item.extracted?.value,
        // 参考范围：已匹配用指标库，新建用 OCR
        referenceRange: isMatched
          ? item.indicatorData.referenceRange
          : (item.extracted?.referenceRange || ''),
        // 是否正常：已匹配用指标库计算结果，新建用 OCR 判断
        isNormal: isMatched
          ? item.indicatorData.isNormal
          : (item.extracted?.abnormalType === 'normal' || item.extracted?.abnormalType === null),
        // 异常类型：已匹配用指标库计算结果，新建用 OCR 判断
        abnormalType: isMatched
          ? item.indicatorData.abnormalType
          : item.extracted?.abnormalType,
        // 备注字段：包含 OCR 识别的范围和异常标记
        notes: isMatched
          ? item.indicatorData.notes
          : buildNotesForNewIndicator(item.extracted),
        // 如果是新建指标，需要额外信息
        newIndicatorInfo: item.isNewIndicator ? {
          name: item.extracted?.name,
          unit: item.extracted?.unit,
          type: 'blood',
          valueType: 'numeric',
          normalMin: item.extracted?.normalMin,
          normalMax: item.extracted?.normalMax
        } : null
      };
    });
    
    // 去重：每个 indicatorId 只保留第一条记录
    const seenIds = new Set();
    const indicatorData = rawIndicatorData.filter(item => {
      if (!item.indicatorId) return true; // 保留新建指标
      if (seenIds.has(item.indicatorId)) {
        console.log('[OCR] 跳过重复指标:', item.indicatorId);
        return false;
      }
      seenIds.add(item.indicatorId);
      return true;
    });
    
    console.log('[OCR] 原始指标数:', rawIndicatorData.length, '去重后:', indicatorData.length);

    onConfirm(indicatorData, selectedIndicators);
    handleReset();
  };

  // 重置状态
  const handleReset = () => {
    setCurrentStep(0);
    setFileList([]);
    setOcrResult(null);
    setParsedIndicators([]);
  };

  // 关闭弹窗
  const handleCancel = () => {
    handleReset();
    onCancel();
  };

  // 辅助函数：为新建指标构建备注
  const buildNotesForNewIndicator = (extracted) => {
    const notes = [];
    
    if (extracted?.referenceRange) {
      notes.push(`报告范围: ${extracted.referenceRange}`);
    }
    
    if (extracted?.abnormalFlag) {
      const flagMeaning = {
        '↑': '偏高',
        '↓': '偏低',
        '+': '阳性',
        '-': '阴性'
      };
      const meaning = flagMeaning[extracted.abnormalFlag] || extracted.abnormalFlag;
      notes.push(`报告标记: ${extracted.abnormalFlag} (${meaning})`);
    }
    
    if (extracted?.unit) {
      notes.push(`单位: ${extracted.unit}`);
    }
    
    return notes.length > 0 ? notes.join('; ') : '';
  };

  // 表格列定义
  const columns = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_, record) => (
        <input
          type="checkbox"
          checked={record.selected}
          onChange={() => toggleIndicatorSelection(record.key)}
        />
      )
    },
    {
      title: '识别名称',
      dataIndex: ['extracted', 'name'],
      key: 'name',
      width: 150,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: '检测值',
      dataIndex: ['extracted', 'value'],
      key: 'value',
      width: 80,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '单位',
      dataIndex: ['extracted', 'unit'],
      key: 'unit',
      width: 60
    },
    {
      title: '参考范围',
      dataIndex: ['extracted', 'referenceRange'],
      key: 'range',
      width: 100
    },
    {
      title: '匹配状态',
      key: 'match',
      width: 100,
      render: (_, record) => {
        if (record.isNewIndicator) {
          return <Tag color="orange">新建</Tag>;
        }
        if (record.matched) {
          return <Tag color="green">已匹配</Tag>;
        }
        return <Tag color="red">未匹配</Tag>;
      }
    },
    {
      title: '指标选择',
      key: 'indicator',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" style={{ width: '100%' }}>
          {record.isNewIndicator ? (
            <Alert message="将创建新指标" type="info" showIcon style={{ padding: '2px 8px' }} />
          ) : (
            <>
              <Select
                placeholder="选择或搜索指标"
                style={{ width: '100%' }}
                value={record.customIndicatorId}
                onChange={(value) => handleIndicatorSelect(record.key, 'customIndicatorId', value)}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {indicators.map(ind => (
                  <Option key={ind.id} value={ind.id}>
                    {ind.name} ({ind.unit})
                  </Option>
                ))}
              </Select>
              <Button 
                type="link" 
                size="small" 
                onClick={() => markAsNewIndicator(record.key)}
                icon={<PlusOutlined />}
              >
                作为新指标
              </Button>
            </>
          )}
        </Space>
      )
    },
    {
      title: '数值确认',
      key: 'valueConfirm',
      width: 100,
      render: (_, record) => (
        <Input
          value={record.customValue}
          onChange={(e) => handleIndicatorSelect(record.key, 'customValue', e.target.value)}
          placeholder="确认数值"
          size="small"
        />
      )
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <ScanOutlined />
          OCR 报告识别
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={1000}
      footer={
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          {currentStep === 2 && (
            <Button type="primary" onClick={handleConfirm} icon={<CheckOutlined />}>
              确认并导入 ({parsedIndicators.filter(i => i.selected).length} 项)
            </Button>
          )}
        </Space>
      }
    >
      {/* 步骤条 */}
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

      {/* 步骤 0: 上传图片 */}
      {currentStep === 0 && (
        <div>
          <Alert
            message="上传医疗报告图片"
            description="请上传清晰的医疗报告图片，系统将自动识别报告中的指标数据。支持 JPG、PNG 等常见图片格式。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <FileImageOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽图片到此区域</p>
            <p className="ant-upload-hint">支持 JPG、PNG、GIF、BMP 格式，文件大小不超过 10MB</p>
          </Dragger>

          <Divider />

          <Space>
            <Text type="secondary">选择 OCR 引擎：</Text>
            <Select
              style={{ width: 200 }}
              placeholder="使用默认引擎"
              allowClear
              onChange={setSelectedEngine}
              value={selectedEngine}
            >
              <Option value="paddleocr">PaddleOCR (本地)</Option>
              <Option value="openai_vision">OpenAI Vision</Option>
              <Option value="baidu_ocr">百度 OCR</Option>
              <Option value="tencent_ocr">腾讯 OCR</Option>
            </Select>
          </Space>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<ScanOutlined />}
              disabled={fileList.length === 0}
              onClick={() => {
                setCurrentStep(1);
                handleRecognize();
              }}
            >
              开始识别
            </Button>
          </div>
        </div>
      )}

      {/* 步骤 1: OCR 识别中 */}
      {currentStep === 1 && (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 24 }}>
            <Title level={4}>正在识别报告...</Title>
            <Paragraph type="secondary">
              系统正在分析报告内容并提取指标数据，请稍候
            </Paragraph>
          </div>
        </div>
      )}

      {/* 步骤 2: 确认指标 */}
      {currentStep === 2 && (
        <div>
          {/* 识别统计 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space split={<Divider type="vertical" />}>
              <span>共识别: <Text strong>{parsedIndicators.length}</Text> 项</span>
              <span>已匹配: <Text strong style={{ color: '#52c41a' }}>{parsedIndicators.filter(i => i.matched).length}</Text> 项</span>
              <span>未匹配: <Text strong style={{ color: '#ff4d4f' }}>{parsedIndicators.filter(i => !i.matched).length}</Text> 项</span>
              <span>已选择: <Text strong style={{ color: '#1890ff' }}>{parsedIndicators.filter(i => i.selected).length}</Text> 项</span>
            </Space>
          </Card>

          {/* 原始 OCR 文本 */}
          {ocrResult && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
                <Text type="secondary">查看原始识别文本</Text>
              </summary>
              <Card size="small">
                <pre style={{ maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {ocrResult.text}
                </pre>
              </Card>
            </details>
          )}

          {/* 指标表格 */}
          <Table
            columns={columns}
            dataSource={parsedIndicators}
            rowKey="key"
            pagination={false}
            size="small"
            scroll={{ x: 900 }}
            rowClassName={(record) => record.selected ? 'selected-row' : ''}
          />

          <Alert
            message="提示"
            description="请检查识别结果，确认指标匹配是否正确。未匹配的指标可以选择已有指标或作为新指标创建。"
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      )}
    </Modal>
  );
};

export default OCRReportRecognition;
