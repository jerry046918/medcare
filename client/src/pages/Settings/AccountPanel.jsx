import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Row, Space, Tag, Typography, message } from 'antd';
import { checkAuthStatus } from '../../store/slices/authSlice';
import authAPI from '../../api/authAPI';

const { Text } = Typography;

// v2 角色徽标（与后端 users.role 枚举一致）
const ROLE_TAGS = {
  admin: { text: '管理员', color: 'red' },
  member: { text: '普通用户', color: 'blue' }
};

// 账户面板：displayName 编辑（POST /auth/update-profile）+ 修改密码（自旧 Settings 迁移，同一 API）
const AccountPanel = () => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // user 由 /auth/me 异步恢复/更新后回填表单
  useEffect(() => {
    profileForm.setFieldsValue({ username: user?.username, displayName: user?.displayName });
  }, [user, profileForm]);

  const handleProfileUpdate = async (values) => {
    setSavingProfile(true);
    try {
      await authAPI.updateProfile({ displayName: values.displayName });
      message.success('资料已更新');
      await dispatch(checkAuthStatus()); // 刷新全局 user（顶栏昵称等同步）
    } catch (error) {
      message.error(error?.response?.data?.message || error?.userMessage || '资料更新失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (values) => {
    setSavingPassword(true);
    try {
      await authAPI.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch (error) {
      const errorMsg = error?.response?.data?.message || error?.userMessage || '修改密码失败';
      message.error(errorMsg);
    } finally {
      setSavingPassword(false);
    }
  };

  const roleTag = ROLE_TAGS[user?.role] || { text: user?.role || '-', color: 'default' };

  return (
    <Row gutter={24}>
      <Col xs={24} lg={14}>
        <Card title="个人资料" size="small" style={{ marginBottom: 24 }}>
          <Form
            form={profileForm}
            layout="vertical"
            onFinish={handleProfileUpdate}
            initialValues={{ username: user?.username, displayName: user?.displayName }}
          >
            <Form.Item name="username" label="用户名">
              <Input disabled />
            </Form.Item>

            <Form.Item
              name="displayName"
              label="显示昵称"
              rules={[
                { required: true, message: '请输入显示昵称' },
                { max: 50, message: '昵称最长50个字符' }
              ]}
            >
              <Input placeholder="请输入显示昵称" maxLength={50} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={savingProfile}>
                保存资料
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="修改密码" size="small">
          <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange}>
            <Form.Item
              name="currentPassword"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="请输入当前密码" />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password placeholder="请输入新密码" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="确认新密码"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  }
                })
              ]}
            >
              <Input.Password placeholder="请再次输入新密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={savingPassword}>
                修改密码
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Card title="账户信息" size="small">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">用户名</Text>
              <div>{user?.username || '-'}</div>
            </div>
            <div>
              <Text type="secondary">显示昵称</Text>
              <div>{user?.displayName || '-'}</div>
            </div>
            <div>
              <Text type="secondary">账户类型</Text>
              <div><Tag color={roleTag.color}>{roleTag.text}</Tag></div>
            </div>
            <div>
              <Text type="secondary">注册时间</Text>
              <div>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</div>
            </div>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
            修改密码后请牢记新密码，下次登录需使用新密码
          </Text>
        </Card>
      </Col>
    </Row>
  );
};

export default AccountPanel;
