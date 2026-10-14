import React, { useEffect, useState } from 'react';
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
  Alert,
  Steps,
  Radio,
  DatePicker,
  Tag
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  HeartOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserAddOutlined,
  KeyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { register, clearError } from '../../store/slices/authSlice';
import authAPI from '../../api/authAPI';
import { resolveBindOptions, buildRegisterPayload } from './registerFormLogic';

const { Title, Text } = Typography;

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated, needsSetup } = useSelector(state => state.auth);
  const [accountForm] = Form.useForm();
  const [memberForm] = Form.useForm();

  // 两步向导状态
  const [step, setStep] = useState(0); // 0 = 账户信息(含邀请码) 1 = 成员绑定
  const [preview, setPreview] = useState(null); // previewInvite 预检结果
  const [previewing, setPreviewing] = useState(false); // 预检请求中
  const [mode, setMode] = useState('create'); // create | claim
  const [claimMemberId, setClaimMemberId] = useState(null);

  // 第二步可用模式由预检结果决定（needsSetup 跳过预检 → 只能新建）
  const options = resolveBindOptions(preview);

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

  // 「下一步」：校验账户信息；非首账户需先预检邀请码，失败停留本步
  const handleNext = async () => {
    try {
      await accountForm.validateFields();
    } catch {
      return; // 字段错误已由 Form 展示
    }

    if (needsSetup) {
      // 首账户初始化：无邀请码，直接进入第二步（只能新建本人成员）
      setPreview(null);
      setMode('create');
      setClaimMemberId(null);
      setStep(1);
      return;
    }

    const inviteCode = (accountForm.getFieldValue('inviteCode') || '').trim();
    if (!inviteCode) {
      message.error('请输入邀请码');
      return;
    }

    setPreviewing(true);
    try {
      const res = await authAPI.previewInvite(inviteCode);
      const result = res.data?.data || null;
      setPreview(result);
      const nextOptions = resolveBindOptions(result);
      setMode(nextOptions.canCreate ? 'create' : 'claim');
      setClaimMemberId(nextOptions.boundMember ? nextOptions.boundMember.id : null);
      setStep(1);
    } catch (err) {
      // 邀请码无效/过期等：提示并停留在第一步
      message.error(err.userMessage || err.response?.data?.message || '邀请码无效');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    let memberValues = {};
    if (mode === 'create') {
      try {
        memberValues = await memberForm.validateFields();
      } catch {
        return; // 字段错误已由 Form 展示
      }
    }
    if (mode === 'claim' && !claimMemberId) {
      message.error('请选择要认领的成员');
      return;
    }

    const payload = buildRegisterPayload({
      username: accountForm.getFieldValue('username'),
      password: accountForm.getFieldValue('password'),
      inviteCode: (accountForm.getFieldValue('inviteCode') || '').trim(),
      mode,
      newMember: {
        name: (memberValues.name || '').trim(),
        gender: memberValues.gender,
        birthday: memberValues.birthday ? memberValues.birthday.format('YYYY-MM-DD') : null
      },
      claimMemberId,
      needsSetup
    });

    try {
      await dispatch(register(payload)).unwrap();
      message.success('注册成功，正在跳转...');
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch {
      // 错误已在Redux中处理
    }
  };

  // 成员年龄（认领卡片展示用）
  const memberAge = (birthday) => {
    if (!birthday) return null;
    const d = dayjs(birthday);
    if (!d.isValid()) return null;
    return dayjs().diff(d, 'year');
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
        styles={{ body: { padding: '40px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
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

        <Steps
          current={step}
          size="small"
          style={{ marginBottom: 32 }}
          items={[{ title: '账户信息' }, { title: '成员绑定' }]}
        />

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

        {/* 第一步：账户信息（首账户无邀请码输入） */}
        <div style={{ display: step === 0 ? 'block' : 'none' }}>
          <Form
            form={accountForm}
            name="registerAccount"
            layout="vertical"
            size="large"
            requiredMark={false}
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

            {!needsSetup && (
              <Form.Item
                name="inviteCode"
                label="邀请码"
                rules={[{ required: true, message: '请输入邀请码' }]}
                extra="请输入管理员分发给您的邀请码"
              >
                <Input
                  prefix={<KeyOutlined />}
                  placeholder="请输入邀请码"
                  autoComplete="off"
                />
              </Form.Item>
            )}

            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                onClick={handleNext}
                loading={previewing}
                block
                style={{
                  height: 48,
                  fontSize: 16,
                  borderRadius: 8
                }}
              >
                下一步
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
        </div>

        {/* 第二步：成员绑定（新建本人成员 / 认领既有成员） */}
        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ width: '100%', marginBottom: 16 }}
            disabled={options.boundMember ? true : false}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {options.canCreate && (
                <Radio value="create">
                  <Space size={4}>
                    <UserAddOutlined />
                    创建新的本人成员
                  </Space>
                </Radio>
              )}
              {options.canClaim && (
                <Radio value="claim">
                  <Space size={4}>
                    <TeamOutlined />
                    认领已有成员
                  </Space>
                </Radio>
              )}
            </Space>
          </Radio.Group>

          {options.boundMember && (
            <Alert
              type="info"
              showIcon
              icon={<TeamOutlined />}
              style={{ marginBottom: 16 }}
              message="专属邀请码"
              description={`该邀请码已绑定成员「${options.boundMember.name}」，注册后将自动认领该成员。`}
            />
          )}

          {mode === 'create' && (
            <Form
              form={memberForm}
              name="registerMember"
              layout="vertical"
              size="large"
              requiredMark={false}
            >
              <Form.Item
                name="name"
                label="姓名"
                rules={[
                  { required: true, message: '请输入姓名' },
                  { max: 50, message: '姓名最多50个字符' }
                ]}
              >
                <Input placeholder="请输入本人姓名" autoComplete="off" />
              </Form.Item>

              <Form.Item
                name="gender"
                label="性别"
                rules={[{ required: true, message: '请选择性别' }]}
              >
                <Radio.Group>
                  <Radio value="男">男</Radio>
                  <Radio value="女">女</Radio>
                  <Radio value="其他">其他</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="birthday"
                label="生日（可选）"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="请选择生日"
                  disabledDate={(current) => current && current.isAfter(dayjs(), 'day')}
                />
              </Form.Item>
            </Form>
          )}

          {mode === 'claim' && (
            <div style={{ marginBottom: 16 }}>
              {options.claimable.length === 0 ? (
                <Text type="secondary">没有可认领的成员</Text>
              ) : (
                options.claimable.map((m) => {
                  const age = memberAge(m.birthday);
                  const selected = claimMemberId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setClaimMemberId(m.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        marginBottom: 8,
                        borderRadius: 8,
                        border: `1px solid ${selected ? '#1890ff' : '#f0f0f0'}`,
                        background: selected ? '#e6f7ff' : '#fafafa',
                        cursor: 'pointer'
                      }}
                    >
                      <Space>
                        <Text strong>{m.name}</Text>
                        <Tag>{m.gender || '未知'}</Tag>
                      </Space>
                      <Text type="secondary">
                        {age !== null ? `${age} 岁` : '年龄未知'}
                      </Text>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <Space style={{ width: '100%' }} direction="vertical" size="middle">
            <Button
              type="primary"
              onClick={handleSubmit}
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
            <Button
              block
              size="large"
              onClick={() => setStep(0)}
              disabled={isLoading}
            >
              上一步
            </Button>
          </Space>
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

export default Register;
