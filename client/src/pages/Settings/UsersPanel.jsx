import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Card, Col, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import userAPI from '../../api/userAPI';

const { Text } = Typography;

const ROLE_OPTIONS = [
  { value: 'member', label: '普通用户' },
  { value: 'admin', label: '管理员' }
];

const roleLabel = (role) => (ROLE_OPTIONS.find((r) => r.value === role) || {}).label || role;

// 用户管理面板（admin）：列表 + 角色切换（不能改自己，后端 PUT /users/:id/role 亦拒绝）
const UsersPanel = () => {
  const { user: me } = useSelector(state => state.auth);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await userAPI.list(); // admin 视角：含 role/createdAt/selfMember
      setUsers(res.data?.data || []);
    } catch (error) {
      message.error(error?.userMessage || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (record, role) => {
    setSavingId(record.id);
    try {
      await userAPI.setRole(record.id, role);
      message.success(`已将 ${record.username} 设为${roleLabel(role)}`);
      load();
    } catch (error) {
      message.error(error?.response?.data?.message || error?.userMessage || '角色更新失败');
    } finally {
      setSavingId(null);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', render: (v, u) => (
      <Space>
        <span style={{ fontWeight: 500 }}>{v}</span>
        {u.id === me?.id && <Tag color="blue">当前账户</Tag>}
      </Space>
    ) },
    { title: '显示昵称', dataIndex: 'displayName', render: (v) => v || '-' },
    { title: '绑定本人', key: 'selfMember', render: (_, u) => u.selfMember ? u.selfMember.name : (
      <Text type="warning">未绑定</Text>
    ) },
    { title: '创建时间', dataIndex: 'createdAt', width: 120, render: (v) => (
      v ? new Date(v).toLocaleDateString() : '-'
    ) },
    { title: '角色', dataIndex: 'role', width: 160, render: (role, record) => {
      const isSelf = record.id === me?.id;
      return (
        <Select
          size="small"
          style={{ width: 120 }}
          value={role}
          options={ROLE_OPTIONS}
          disabled={isSelf}
          loading={savingId === record.id}
          onChange={(value) => handleRoleChange(record, value)}
          title={isSelf ? '不能修改自己的角色' : undefined}
        />
      );
    } }
  ];

  return (
    <Row gutter={24}>
      <Col span={24}>
        <Card
          type="inner"
          title="用户管理"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>管理员可调整账户角色；不能修改自己的角色</Text>}
        >
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={users}
            pagination={false}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default UsersPanel;
