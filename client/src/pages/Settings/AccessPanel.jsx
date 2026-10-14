import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import familyMemberAPI from '../../api/familyMemberAPI';
import userAPI from '../../api/userAPI';

const { Text } = Typography;

// 我的 link 角色 → 徽标/文案（与后端 UserMemberLink.role 对齐）
const MY_ROLE = {
  self: { label: '本人', color: 'blue' },
  owner: { label: '代管', color: 'purple' },
  admin: { label: '管理员视角', color: 'red' },
  editor: { label: '可编辑', color: 'cyan' },
  viewer: { label: '只读', color: 'default' }
};

// 被授权人 link 角色 → 徽标
const LINK_ROLE = {
  self: { label: '本人', color: 'blue' },
  owner: { label: '代管人', color: 'purple' },
  editor: { label: '可编辑', color: 'cyan' },
  viewer: { label: '只读', color: 'default' }
};

// 展开行：单个成员的授权列表（GET /members/:id/links）+ 撤销 + 授权
// 非受权角色（403）时静默跳过，不阻塞页面
function MemberLinks({ member, isAdmin, onChanged }) {
  const [form] = Form.useForm();
  const [links, setLinks] = useState(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grantError, setGrantError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await familyMemberAPI.listLinks(member.id);
      setLinks(res.data?.data || []);
      setDenied(false);
    } catch (error) {
      if (error?.response?.status === 403) {
        setDenied(true); // 无 grant 权限：跳过详情
      } else {
        message.error(error?.userMessage || '获取授权列表失败');
        setLinks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [member.id]);

  const openGrant = async () => {
    setGrantOpen(true);
    setGrantError(null);
    form.resetFields();
    form.setFieldsValue({ role: 'viewer', relationship: '家人' });
    if (users.length === 0) {
      setUsersLoading(true);
      try {
        // 登录即可调（Task 12）：返回 id/username/displayName 基础字段
        const res = await userAPI.list();
        setUsers(res.data?.data || []);
      } catch (error) {
        message.error(error?.userMessage || '获取用户列表失败');
      } finally {
        setUsersLoading(false);
      }
    }
  };

  const handleGrant = async (values) => {
    setSubmitting(true);
    setGrantError(null);
    try {
      await familyMemberAPI.grantLink(member.id, {
        granteeUserId: values.granteeUserId,
        role: values.role,
        relationship: values.relationship || '家人'
      });
      message.success('授权成功');
      setGrantOpen(false);
      load();
      onChanged?.();
    } catch (error) {
      // 后端 409（重复授权/已绑定本人）等业务错误保留弹窗并提示
      setGrantError(error?.response?.data?.message || error?.userMessage || '授权失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (linkId) => {
    setRevokingId(linkId);
    try {
      await familyMemberAPI.revokeLink(member.id, linkId);
      message.success('已撤销授权');
      load();
      onChanged?.();
    } catch (error) {
      message.error(error?.response?.data?.message || error?.userMessage || '撤销失败');
    } finally {
      setRevokingId(null);
    }
  };

  if (denied) {
    return <Text type="secondary">当前账户无权查看该成员的授权详情</Text>;
  }
  if (loading) return <Spin size="small" />;

  const grantedUserIds = new Set((links || []).map((l) => l.userId));

  const columns = [
    { title: '被授权人', key: 'user', render: (_, l) => (
      <Space>
        <span>{l.displayName || l.username}</span>
        {l.displayName && <Text type="secondary" style={{ fontSize: 12 }}>@{l.username}</Text>}
      </Space>
    ) },
    { title: '权限', dataIndex: 'role', width: 110, render: (role) => {
      const tag = LINK_ROLE[role] || { label: role, color: 'default' };
      return <Tag color={tag.color}>{tag.label}</Tag>;
    } },
    { title: '关系', dataIndex: 'relationship', width: 110, render: (v) => v || '-' },
    { title: '操作', key: 'action', width: 130, render: (_, l) => {
      // self link 仅 admin 可撤销（后端 403），非 admin 置灰防呆
      const selfLocked = l.role === 'self' && !isAdmin;
      return (
        <Popconfirm
          title="确定撤销该授权？"
          description="撤销后对方将立即失去此成员的访问权限。"
          onConfirm={() => handleRevoke(l.id)}
          okText="撤销"
          cancelText="取消"
          disabled={selfLocked}
        >
          <Button danger size="small" type="link" loading={revokingId === l.id} disabled={selfLocked}>
            撤销
          </Button>
        </Popconfirm>
      );
    } }
  ];

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {(links || []).length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无其他授权，可邀请家人共享此成员" />
        ) : (
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={links}
            pagination={false}
          />
        )}
        <div>
          <Button size="small" type="primary" ghost icon={<UserAddOutlined />} onClick={openGrant}>
            授权
          </Button>
        </div>
      </Space>

      <Modal
        title={`授权访问「${member.name}」`}
        open={grantOpen}
        onCancel={() => setGrantOpen(false)}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={handleGrant}>
          {grantError && (
            <Alert type="error" showIcon style={{ marginBottom: 16 }} message={grantError} />
          )}
          <Form.Item
            name="granteeUserId"
            label="用户"
            rules={[{ required: true, message: '请选择要授权的用户' }]}
          >
            <Select
              placeholder="请选择用户"
              loading={usersLoading}
              showSearch
              optionFilterProp="label"
              options={users.map((u) => ({
                value: u.id,
                label: u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`,
                disabled: grantedUserIds.has(u.id) // 已有授权的用户禁选，防重复授权
              }))}
            />
          </Form.Item>
          <Form.Item name="role" label="权限级别" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="viewer">只读（viewer）</Select.Option>
              <Select.Option value="editor">可编辑（editor）</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="relationship" label="关系备注" extra="如：父亲、母亲（选填，默认「家人」）">
            <Input placeholder="家人" maxLength={20} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>确认授权</Button>
              <Button onClick={() => setGrantOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// 我的授权面板：GET /members 可见成员按我的角色分两组
// - 我管理的（self/owner/admin）：展开可见授权明细，可授权/撤销
// - 共享给我的（viewer/editor）：只读展示成员与我的级别
const AccessPanel = () => {
  const { role: myAccountRole } = useSelector(state => state.auth);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await familyMemberAPI.getAll();
      setMembers(res.data?.data || []);
    } catch (error) {
      message.error(error?.userMessage || '获取成员列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const managed = members.filter((m) => ['self', 'owner', 'admin'].includes(m.role));
  const shared = members.filter((m) => ['viewer', 'editor'].includes(m.role));

  const managedColumns = [
    { title: '成员', dataIndex: 'name', render: (name, m) => (
      <Space>
        <span style={{ fontWeight: 500 }}>{name}</span>
        <Tag color={(MY_ROLE[m.role] || {}).color}>{(MY_ROLE[m.role] || {}).label || m.role}</Tag>
      </Space>
    ) },
    { title: '性别', dataIndex: 'gender', width: 80 },
    { title: '报告数', dataIndex: 'reportCount', width: 90, render: (v) => v ?? 0 },
    { title: '关系备注', dataIndex: 'relationship', width: 110, render: (v) => v || '-' }
  ];

  const sharedColumns = [
    { title: '成员', dataIndex: 'name', render: (name, m) => (
      <Space>
        <span style={{ fontWeight: 500 }}>{name}</span>
        <Tag color={(MY_ROLE[m.role] || {}).color}>{(MY_ROLE[m.role] || {}).label || m.role}</Tag>
      </Space>
    ) },
    { title: '我的权限', dataIndex: 'role', width: 110, render: (role) => (
      <Tag color={(MY_ROLE[role] || {}).color}>{(MY_ROLE[role] || {}).label || role}</Tag>
    ) },
    { title: '性别', dataIndex: 'gender', width: 80 },
    { title: '关系备注', dataIndex: 'relationship', width: 110, render: (v) => v || '-' }
  ];

  return (
    <Row gutter={[24, 24]}>
      <Col span={24}>
        <Card
          type="inner"
          title="我管理的"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>可查看授权明细并授予/撤销他人访问</Text>}
        >
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            columns={managedColumns}
            dataSource={managed}
            pagination={false}
            locale={{ emptyText: '暂无由你管理的成员' }}
            expandable={{
              rowExpandable: () => true,
              expandedRowRender: (record) => (
                <MemberLinks
                  member={record}
                  isAdmin={myAccountRole === 'admin'}
                  onChanged={load}
                />
              )
            }}
          />
        </Card>
      </Col>

      <Col span={24}>
        <Card
          type="inner"
          title="共享给我的"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>他人授权你访问的成员，权限以授权级别为准</Text>}
        >
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            columns={sharedColumns}
            dataSource={shared}
            pagination={false}
            locale={{ emptyText: '暂无共享给你的成员' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default AccessPanel;
