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
  Divider,
  Alert
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  HeartOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { register, clearError } from '../../store/slices/authSlice';

const { Title, Text } = Typography;

const Register = () => {
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
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleSubmit = async (values) => {
    try {
      await dispatch(register(values)).unwrap();
      message.success('注册成功，正在跳转...');
      setTimeout(() => {
        navigate('/');
      }, 1000);
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
          maxWidth: 450,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Space direction="vertical" size="small">
            <HeartOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              家庭健康管理
            </Title>
            <Text type="secondary">
              {needsSetup ? '系统初始化 - 创建管理员账户' : '创建新账户'}
            </Text>
          </Space>
        </div>

        {needsSetup && (
          <Alert
            message="系统初始化"
            description="这是您第一次使用系统，请创建管理员账户。管理员账户将拥有系统的完全访问权限。"
            type="info"
            icon={<SafetyOutlined />}
            style={{ marginBottom: 24 }}
            showIcon
          />
        )}

        <Form
          form={form}
          name="register"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
              {
                pattern: /^[a-zA-Z0-9_]+$/,
                message: '用户名只能包含字母、数字和下划线'
              }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
              { max: 50, message: '密码最多50个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入密码"
              autoComplete="new-password"
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
              {needsSetup ? '创建管理员账户' : '注册'}
            </Button>
          </Form.Item>
        </Form>

        {!needsSetup && (
          <>
            <Divider plain>
              <Text type="secondary">已有账户？</Text>
            </Divider>

            <div style={{ textAlign: 'center' }}>
              <Link to="/login">
                <Button type="link" size="large">
                  立即登录
                </Button>
              </Link>
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            家庭健康管理系统 v1.0
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Register;