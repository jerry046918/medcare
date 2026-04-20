import React, { useState, useEffect } from 'react';
import {
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
  Card,
  message,
  Spin,
  Tag,
  Radio
} from 'antd';
import {
  CloudOutlined,
  LaptopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Password } = Input;

const OCRSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [engines, setEngines] = useState([]);

  useEffect(() => {
    loadConfig();
    loadEngines();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/ocr/full');
      if (response.data.success) {
        form.setFieldsValue(response.data.data);
      }
    } catch (error) {
      console.error('加载 OCR 配置失败:', error);
      message.error('加载 OCR 配置失败');
    } finally {
      setLoading(false);
    }
  };

  const loadEngines = async () => {
    try {
      const response = await api.get('/ocr/engines');
      if (response.data.success) {
        setEngines(response.data.data);
      }
    } catch (error) {
      console.error('获取引擎列表失败:', error);
    }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const response = await api.post('/config/ocr/batch', values);
      if (response.data.success) {
        message.success('OCR 配置保存成功');
        loadEngines();
      }
    } catch (error) {
      console.error('保存 OCR 配置失败:', error);
      message.error('保存 OCR 配置失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const getEngineStatus = (engineName) => {
    const engine = engines.find(e => e.name === engineName);
    return engine?.available || false;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载配置中...</div>
      </div>
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
      initialValues={{
        defaultEngine: 'paddleocr',
        paddleocr: { enabled: true, pythonPath: 'python' },
        openai_vision: { enabled: false, apiKey: '', baseURL: '', model: '' }
      }}
    >
      {/* 引擎选择 */}
      <Card title="OCR 识别引擎" style={{ marginBottom: 24 }}>
        <Form.Item
          name="defaultEngine"
          label="选择识别引擎"
          rules={[{ required: true, message: '请选择 OCR 引擎' }]}
        >
          <Radio.Group>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="paddleocr">
                <Space>
                  <LaptopOutlined />
                  <span>本地 OCR (PaddleOCR)</span>
                  {getEngineStatus('paddleocr') ?
                    <Tag color="green" icon={<CheckCircleOutlined />}>可用</Tag> :
                    <Tag color="red" icon={<CloseCircleOutlined />}>不可用</Tag>
                  }
                </Space>
                <div style={{ marginLeft: 24, color: '#888', fontSize: 13 }}>
                  数据不出本地，需要 Python 环境
                </div>
              </Radio>
              <Radio value="openai_vision">
                <Space>
                  <CloudOutlined />
                  <span>云端 OCR</span>
                  {getEngineStatus('openai_vision') ?
                    <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag> :
                    <Tag color="orange">未配置</Tag>
                  }
                </Space>
                <div style={{ marginLeft: 24, color: '#888', fontSize: 13 }}>
                  兼容 OpenAI API 格式，支持多种服务商
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
      </Card>

      {/* 本地 OCR 配置 */}
      <Card
        title={
          <Space>
            <LaptopOutlined />
            <span>本地 OCR 配置</span>
            {getEngineStatus('paddleocr') ?
              <Tag color="green" icon={<CheckCircleOutlined />}>可用</Tag> :
              <Tag color="red" icon={<CloseCircleOutlined />}>不可用</Tag>
            }
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Alert
          message="需要安装 Python 环境和 PaddleOCR 库"
          description="运行: pip install paddleocr paddlepaddle"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form.Item
          name={['paddleocr', 'enabled']}
          label="启用本地 OCR"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name={['paddleocr', 'pythonPath']}
          label="Python 路径"
          extra="默认使用系统 PATH 中的 python"
        >
          <Input placeholder="python 或 python3 或完整路径" />
        </Form.Item>
      </Card>

      {/* 云端 OCR 配置 */}
      <Card
        title={
          <Space>
            <CloudOutlined />
            <span>云端 OCR 配置</span>
            {getEngineStatus('openai_vision') ?
              <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag> :
              <Tag color="orange">未配置</Tag>
            }
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Alert
          message="支持所有兼容 OpenAI API 格式的服务商"
          description="如 OpenAI、DeepSeek、通义千问、智谱、Siliconflow 等，填写对应的 Base URL、API Key 和模型名称即可"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form.Item
          name={['openai_vision', 'enabled']}
          label="启用云端 OCR"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name={['openai_vision', 'baseURL']}
          label="API Base URL"
          rules={[{ required: form.getFieldValue(['openai_vision', 'enabled']), message: '请输入 API 地址' }]}
          extra="服务商提供的 API 地址，如 https://api.openai.com/v1"
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item
          name={['openai_vision', 'apiKey']}
          label="API Key"
          rules={[{ required: form.getFieldValue(['openai_vision', 'enabled']), message: '请输入 API Key' }]}
        >
          <Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item
          name={['openai_vision', 'model']}
          label="模型 ID"
          rules={[{ required: form.getFieldValue(['openai_vision', 'enabled']), message: '请输入模型名称' }]}
          extra="如 gpt-4o、deepseek-chat、qwen-vl-plus 等"
        >
          <Input placeholder="gpt-4o" />
        </Form.Item>
      </Card>

      {/* 保存按钮 */}
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
          保存配置
        </Button>
      </Form.Item>
    </Form>
  );
};

export default OCRSettings;
