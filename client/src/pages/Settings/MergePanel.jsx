import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  message
} from 'antd';
import { MergeCellsOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import familyMemberAPI from '../../api/familyMemberAPI';

const { Text, Paragraph } = Typography;

const toOption = (m) => ({
  value: m.id,
  label: `${m.name}（${m.gender}${m.birthday ? `，${dayjs(m.birthday).format('YYYY-MM-DD')}` : ''}）`
});

// 成员合并面板（admin）：source 数据（报告/用药/记录/授权）并入 target 后删除 source
const MergePanel = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceId, setSourceId] = useState();
  const [targetId, setTargetId] = useState();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await familyMemberAPI.getAll(); // admin 可见全部成员
      setMembers(res.data?.data || []);
    } catch (error) {
      message.error(error?.userMessage || '获取成员列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const source = members.find((m) => m.id === sourceId);
  const target = members.find((m) => m.id === targetId);

  const handleMerge = async () => {
    setSubmitting(true);
    try {
      await familyMemberAPI.merge(sourceId, targetId);
      message.success('成员合并成功');
      setConfirmOpen(false);
      setSourceId(undefined);
      setTargetId(undefined);
      load();
    } catch (error) {
      message.error(error?.response?.data?.message || error?.userMessage || '合并失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Row gutter={24}>
      <Col span={24}>
        <Card
          type="inner"
          title="成员合并"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>重复建档时，将一个成员的数据并入另一个</Text>}
        >
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
            message="合并不可撤销"
            description="合并后「源成员」的医疗报告、用药、健康记录与授权关系全部转移至「目标成员」，源成员将被删除。"
          />

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>源成员（被并入，将被删除）</Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: '100%', maxWidth: 480 }}
                placeholder="选择要被合并的成员"
                loading={loading}
                value={sourceId}
                onChange={(v) => { setSourceId(v); if (v === targetId) setTargetId(undefined); }}
                options={members.map(toOption)}
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>目标成员（保留）</Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: '100%', maxWidth: 480 }}
                placeholder="选择保留的成员"
                loading={loading}
                value={targetId}
                onChange={(v) => setTargetId(v)}
                options={members.filter((m) => m.id !== sourceId).map(toOption)}
              />
            </div>
            <div>
              <Button
                type="primary"
                danger
                icon={<MergeCellsOutlined />}
                disabled={!sourceId || !targetId}
                onClick={() => setConfirmOpen(true)}
              >
                合并成员
              </Button>
            </div>
          </Space>
        </Card>
      </Col>

      <Modal
        title="确认合并成员"
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        footer={null}
        width={460}
      >
        <Paragraph>
          将把 <Text strong>「{source?.name}」</Text> 的全部数据并入 <Text strong>「{target?.name}」</Text>：
        </Paragraph>
        <ul style={{ paddingLeft: 20, color: '#666' }}>
          <li>医疗报告、用药、健康记录 → 归属目标成员</li>
          <li>授权关系（含本人绑定）→ 转移至目标成员</li>
          <li>源成员删除后无法恢复</li>
        </ul>
        <Paragraph type="warning">此操作不可撤销，请确认无误后执行。</Paragraph>
        <Space style={{ marginTop: 16 }}>
          <Button danger type="primary" loading={submitting} onClick={handleMerge}>确认合并</Button>
          <Button onClick={() => setConfirmOpen(false)}>取消</Button>
        </Space>
      </Modal>
    </Row>
  );
};

export default MergePanel;
