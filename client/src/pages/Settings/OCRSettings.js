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
  Tag
} from 'antd';
import {
  CloudOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Password } = Input;

const OCRSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [engines, setEngines] = useState([]);
  const [config, setConfig] = useState({
    defaultEngine: 'paddleocr',
    paddleocr: { enabled: true, pythonPath: 'python' },
    openai_vision: { enabled: false, apiKey: '', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o' },
    baidu_ocr: { enabled: false, apiKey: '', secretKey: '' },
    tencent_ocr: { enabled: false, secretId: '', secretKey: '', region: 'ap-beijing' }
  });

  useEffect(() => {
    loadConfig();
    loadEngines();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/ocr/full');
      if (response.data.success) {
        setConfig(response.data.data);
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
        loadEngines(); // 刷新引擎状态
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
      initialValues={config}
    >
      {/* 默认引擎选择 */}
      <Card title="默认 OCR 引擎" style={{ marginBottom: 24 }}>
        <Form.Item
          name="defaultEngine"
          label="选择默认引擎"
          rules={[{ required: true, message: '请选择默认 OCR 引擎' }]}
        >
          <Select>
            <Option value="paddleocr">
              <Space>
                PaddleOCR (本地)
                {getEngineStatus('paddleocr') ? 
                  <Tag color="green" icon={<CheckCircleOutlined />}>可用</Tag> :
                  <Tag color="red" icon={<CloseCircleOutlined />}>不可用</Tag>
                }
              </Space>
            </Option>
            <Option value="openai_vision">
              <Space>
                OpenAI Vision (云端)
                {getEngineStatus('openai_vision') ? 
                  <Tag color="green" icon={<CheckCircleOutlined />}>可用</Tag> :
                  <Tag color="orange">需配置</Tag>
                }
              </Space>
            </Option>
            <Option value="baidu_ocr">
              <Space>
                百度 OCR (云端)
                {getEngineStatus('baidu_ocr') ? 
                  <Tag color="green" icon={<CheckCircleOutlined />}>可用</Tag> :
                  <Tag color="orange">需配置</Tag>
                }
              </Space>
            </Option>
            <Option value="tencent_ocr">
              <Space>
                腾讯 OCR (云端)
                {getEngineStatus('tencent_ocr') ? 
                  <Tag color="green" icon={<CheckCircleOutlined />}>可用</Tag> :
                  <Tag color="orange">需配置</Tag>
                }
              </Space>
            </Option>
          </Select>
        </Form.Item>
        <Alert
          message="引擎说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><b>PaddleOCR</b>：本地引擎，需要 Python 环境，识别效果好，数据不出本地</li>
              <li><b>OpenAI Vision</b>：云端引擎，识别精度高，能理解复杂报告结构，需要 API Key</li>
              <li><b>百度 OCR</b>：国内云服务，中文识别效果好，需要申请 API Key</li>
              <li><b>腾讯 OCR</b>：国内云服务，稳定可靠，需要申请 Secret ID/Key</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Card>

      {/* PaddleOCR 配置 */}
      <Card 
        title={
          <Space>
            <span>PaddleOCR (本地引擎)</span>
            {getEngineStatus('paddleocr') ? 
              <Tag color="green" icon={<CheckCircleOutlined />}>可用</Tag> :
              <Tag color="red" icon={<CloseCircleOutlined />}>不可用</Tag>
            }
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Alert
          message="配置要求"
          description="PaddleOCR 需要安装 Python 环境和 PaddleOCR 库。请运行: pip install paddleocr"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form.Item
          name={['paddleocr', 'enabled']}
          label="启用 PaddleOCR"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name={['paddleocr', 'pythonPath']}
          label="Python 路径"
          extra="默认使用系统 PATH 中的 python，如需指定请填写完整路径"
        >
          <Input placeholder="python 或 python3 或完整路径" />
        </Form.Item>
      </Card>

      {/* OpenAI Vision 配置 */}
      <Card 
        title={
          <Space>
            <CloudOutlined />
            <span>OpenAI Vision (云端)</span>
            {getEngineStatus('openai_vision') ? 
              <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag> :
              <Tag color="orange">未配置</Tag>
            }
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Form.Item
          name={['openai_vision', 'enabled']}
          label="启用 OpenAI Vision"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name={['openai_vision', 'apiKey']}
          label="API Key"
          rules={[{ required: form.getFieldValue(['openai_vision', 'enabled']), message: '请输入 API Key' }]}
        >
          <Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item
          name={['openai_vision', 'baseURL']}
          label="API Base URL"
          extra="默认使用 OpenAI 官方地址，如使用代理可修改"
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item
          name={['openai_vision', 'model']}
          label="模型"
        >
          <Select>
            <Option value="gpt-4o">GPT-4o (推荐)</Option>
            <Option value="gpt-4o-mini">GPT-4o Mini (更便宜)</Option>
            <Option value="gpt-4-turbo">GPT-4 Turbo</Option>
          </Select>
        </Form.Item>
      </Card>

      {/* 百度 OCR 配置 */}
      <Card 
        title={
          <Space>
            <ApiOutlined />
            <span>百度 OCR (云端)</span>
            {getEngineStatus('baidu_ocr') ? 
              <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag> :
              <Tag color="orange">未配置</Tag>
            }
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Alert
          message="申请地址"
          description={<a href="https://console.bce.baidu.com/ai/#/ai/ocr/overview/index" target="_blank" rel="noopener noreferrer">https://console.bce.baidu.com/ai/#/ai/ocr/overview/index</a>}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form.Item
          name={['baidu_ocr', 'enabled']}
          label="启用百度 OCR"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name={['baidu_ocr', 'apiKey']}
          label="API Key"
          rules={[{ required: form.getFieldValue(['baidu_ocr', 'enabled']), message: '请输入 API Key' }]}
        >
          <Input placeholder="请输入百度云 API Key" />
        </Form.Item>
        <Form.Item
          name={['baidu_ocr', 'secretKey']}
          label="Secret Key"
          rules={[{ required: form.getFieldValue(['baidu_ocr', 'enabled']), message: '请输入 Secret Key' }]}
        >
          <Password placeholder="请输入百度云 Secret Key" />
        </Form.Item>
      </Card>

      {/* 腾讯 OCR 配置 */}
      <Card 
        title={
          <Space>
            <ApiOutlined />
            <span>腾讯 OCR (云端)</span>
            {getEngineStatus('tencent_ocr') ? 
              <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag> :
              <Tag color="orange">未配置</Tag>
            }
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Alert
          message="申请地址"
          description={<a href="https://console.cloud.tencent.com/ocr" target="_blank" rel="noopener noreferrer">https://console.cloud.tencent.com/ocr</a>}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form.Item
          name={['tencent_ocr', 'enabled']}
          label="启用腾讯 OCR"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name={['tencent_ocr', 'secretId']}
          label="Secret ID"
          rules={[{ required: form.getFieldValue(['tencent_ocr', 'enabled']), message: '请输入 Secret ID' }]}
        >
          <Input placeholder="请输入腾讯云 Secret ID" />
        </Form.Item>
        <Form.Item
          name={['tencent_ocr', 'secretKey']}
          label="Secret Key"
          rules={[{ required: form.getFieldValue(['tencent_ocr', 'enabled']), message: '请输入 Secret Key' }]}
        >
          <Password placeholder="请输入腾讯云 Secret Key" />
        </Form.Item>
        <Form.Item
          name={['tencent_ocr', 'region']}
          label="服务区域"
        >
          <Select>
            <Option value="ap-beijing">北京</Option>
            <Option value="ap-shanghai">上海</Option>
            <Option value="ap-guangzhou">广州</Option>
            <Option value="ap-chengdu">成都</Option>
          </Select>
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
