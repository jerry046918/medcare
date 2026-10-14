import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import inviteAPI from '../../api/inviteAPI';
import familyMemberAPI from '../../api/familyMemberAPI';

const { Text } = Typography;

// 邀请码管理面板（admin）：列表/新建/停用
const InvitePanel = () => {
  const [form] = Form.useForm();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [claimable, setClaimable] = useState([]);
  const [claimableLoading, setClaimableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await inviteAPI.list();
      setInvites(res.data?.data || []);
    } catch (error) {
      message.error(error?.userMessage || '获取邀请码列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = async () => {
    setCreateOpen(true);
    form.resetFields();
    form.setFieldsValue({ maxUses: 1 });
    setClaimableLoading(true);
    try {
      // 专属码只能发给尚无本人绑定的成员（后端 createInvite 对已绑定成员 400），
      // 故下拉数据取 GET /members?claimable=1（无 self link 成员）
      const res = await familyMemberAPI.listClaimable();
      setClaimable(res.data?.data || []);
    } catch (error) {
      message.error(error?.userMessage || '获取可邀请成员失败');
      setClaimable([]);
    } finally {
      setClaimableLoading(false);
    }
  };

  const handleCreate = async (values) => {
    setSubmitting(true);
    try {
      await inviteAPI.create({
        memberId: values.memberId || undefined,
        maxUses: values.maxUses || 1,
        expiresDays: values.expiresDays || undefined
      });
      message.success('邀请码创建成功');
      setCreateOpen(false);
      load();
    } catch (error) {
      message.error(error?.response?.data?.message || error?.userMessage || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id) => {
    setDeactivatingId(id);
    try {
      await inviteAPI.remove(id);
      message.success('邀请码已停用');
      load();
    } catch (error) {
      message.error(error?.response?.data?.message || error?.userMessage || '停用失败');
    } finally {
      setDeactivatingId(null);
    }
  };

  const columns = [
    { title: '邀请码', dataIndex: 'code', width: 160, render: (code, inv) => (
      <Space>
        <Text copyable={{ text: code }} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{code}</Text>
        {inv.memberId && <Tag color="purple">专属</Tag>}
      </Space>
    ) },
    { title: '用途', key: 'purpose', render: (_, inv) => inv.member ? inv.member.name : '通用' },
    { title: '使用次数', key: 'usage', width: 100, render: (_, inv) => `${inv.usedCount}/${inv.maxUses}` },
    { title: '过期时间', dataIndex: 'expiresAt', width: 140, render: (v) => (
      v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '永久有效'
    ) },
    { title: '状态', dataIndex: 'active', width: 100, render: (active, inv) => {
      if (!active) return <Tag color="default">已停用</Tag>;
      if (inv.expiresAt && dayjs(inv.expiresAt).isBefore(dayjs())) return <Tag color="orange">已过期</Tag>;
      if (inv.usedCount >= inv.maxUses) return <Tag color="orange">已用完</Tag>;
      return <Tag color="green">可用</Tag>;
    } },
    { title: '操作', key: 'action', width: 100, render: (_, inv) => inv.active ? (
      <Popconfirm
        title="确定停用该邀请码？"
        description="停用后立即不可用于注册，操作不可恢复。"
        onConfirm={() => handleDeactivate(inv.id)}
        okText="停用"
        cancelText="取消"
      >
        <Button danger size="small" type="link" loading={deactivatingId === inv.id}>停用</Button>
      </Popconfirm>
    ) : null }
  ];

  return (
    <Row gutter={24}>
      <Col span={24}>
        <Card
          type="inner"
          title="邀请码管理"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建邀请码</Button>
          }
        >
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={invites}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无邀请码" /> }}
          />
        </Card>
      </Col>

      <Modal
        title="新建邀请码"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="memberId"
            label="绑定成员（可选）"
            extra="不选则为通用码；选择成员则为专属码，注册时只能认领该成员（仅列出尚未绑定账户的成员）"
          >
            <Select
              placeholder="通用码（不限定成员）"
              allowClear
              loading={claimableLoading}
              showSearch
              optionFilterProp="label"
              options={claimable.map((m) => ({
                value: m.id,
                label: `${m.name}（${m.gender}${m.birthday ? `，${dayjs(m.birthday).format('YYYY-MM-DD')}` : ''}）`
              }))}
            />
          </Form.Item>
          <Form.Item
            name="maxUses"
            label="可使用次数"
            rules={[{ required: true, message: '请输入可使用次数' }]}
            extra="同一邀请码可注册的账户数量（1-100）"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="expiresDays"
            label="有效天数（可选）"
            extra="从现在起算；不填则永久有效"
          >
            <InputNumber min={1} max={3650} style={{ width: '100%' }} placeholder="永久有效" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>创建</Button>
              <Button onClick={() => setCreateOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
};

export default InvitePanel;
