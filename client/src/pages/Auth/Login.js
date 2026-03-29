import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  message,
  Typography,
  Space,
  Divider
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  HeartOutlined
} from '@ant-design/icons';
import { login, clearError } from '../../store/slices/authSlice';

const { Title, Text } = Typography;

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated, needsSetup } = useSelector(state => state.auth);
  const [form] = Form.useForm();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (needsSetup) {
      navigate('/register');
    }
  }, [needsSetup, navigate]);

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleSubmit = async (values) => {
    try {
      await dispatch(login(values)).unwrap();
      message.success('登录成功');
      navigate('/');
    } catch (error) {
      // 错误已在Redux中处理
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px'
        }}
        styles={{ body: { padding: '40px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Space direction="vertical" size="small">
            <HeartOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              家庭健康管理
            </Title>
            <Text type="secondary">请登录您的账户</Text>
          </Space>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              style={{
                height: 48,
                fontSize: 16,
                borderRadius: 8
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <Divider plain>
          <Text type="secondary">还没有账户？</Text>
        </Divider>

        <div style={{ textAlign: 'center' }}>
          <Link to="/register">
            <Button type="link" size="large">
              立即注册
            </Button>
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            家庭健康管理系统 v1.0
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;