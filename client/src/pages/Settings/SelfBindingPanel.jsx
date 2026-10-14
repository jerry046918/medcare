import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message
} from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { checkAuthStatus } from '../../store/slices/authSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';
import { resolveBindOptions } from '../Auth/registerFormLogic';
import familyMemberAPI from '../../api/familyMemberAPI';

const { Text } = Typography;

// 本人绑定面板：展示 selfMember；老账户（null）引导补绑（新建/认领，POST /members/bind-self）
const SelfBindingPanel = () => {
  const dispatch = useDispatch();
  const { selfMember } = useSelector(state => state.auth);

  const [bindOpen, setBindOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [options, setOptions] = useState({ canCreate: true, canClaim: false, claimable: [] });
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const openBindModal = async () => {
    setBindOpen(true);
    form.resetFields();
    setOptionsLoading(true);
    setMode('create');
    try {
      // resolveBindOptions({ claimableMembers })：无可认领成员时收窄为仅可新建
      const res = await familyMemberAPI.listClaimable();
      const resolved = resolveBindOptions({ claimableMembers: res.data?.data || [] });
      setOptions(resolved);
      setMode(resolved.canCreate ? 'create' : 'claim');
    } catch (error) {
      message.error(error?.userMessage || '获取可认领成员失败');
      setOptions({ canCreate: true, canClaim: false, claimable: [] });
    } finally {
      setOptionsLoading(false);
    }
  };

  const handleBind = async (values) => {
    setSubmitting(true);
    try {
      const payload = mode === 'claim'
        ? { mode: 'claim', claimMemberId: values.claimMemberId }
        : {
            mode: 'create',
            memberData: {
              name: values.name,
              gender: values.gender,
              birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : undefined
            }
          };
      await familyMemberAPI.bindSelf(payload);
      message.success('本人信息绑定成功');
      setBindOpen(false);
      // 刷新全局 auth（selfMember）与成员列表，其他页面立即可见
      await dispatch(checkAuthStatus());
      dispatch(fetchFamilyMembers());
    } catch (error) {
      message.error(error?.response?.data?.message || error?.userMessage || '绑定失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (selfMember) {
    return (
      <Row gutter={24}>
        <Col xs={24} lg={14}>
          <Alert
            type="success"
            showIcon
            message="已绑定本人成员"
            description="上传报告、查看数据时将以本人成员作为默认视角。"
            style={{ marginBottom: 24 }}
          />
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="姓名">{selfMember.name}</Descriptions.Item>
            <Descriptions.Item label="性别">{selfMember.gender}</Descriptions.Item>
            <Descriptions.Item label="生日">
              {selfMember.birthday ? dayjs(selfMember.birthday).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="视角关系">
              <Tag color="blue">{selfMember.relationship || '本人'}</Tag>
            </Descriptions.Item>
          </Descriptions>
          <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
            如本人资料（姓名/生日）有误，可在「家庭成员」中编辑该成员。
          </Text>
        </Col>
      </Row>
    );
  }

  return (
    <Row gutter={24}>
      <Col xs={24} lg={14}>
        <Alert
          type="warning"
          showIcon
          message="尚未绑定本人成员"
          description="老账户可能缺少本人绑定。绑定后系统才能把报告与数据归属到你本人视角。"
          action={
            <Button type="primary" icon={<UserAddOutlined />} onClick={openBindModal}>
              立即绑定
            </Button>
          }
        />
      </Col>

      <Modal
        title="绑定本人信息"
        open={bindOpen}
        onCancel={() => setBindOpen(false)}
        footer={null}
        width={480}
      >
        {optionsLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : (
          <Form form={form} layout="vertical" onFinish={handleBind}>
            {options.canCreate && options.canClaim && (
              <Form.Item label="绑定方式">
                <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
                  <Radio.Button value="create">新建本人成员</Radio.Button>
                  <Radio.Button value="claim">认领已有成员</Radio.Button>
                </Radio.Group>
              </Form.Item>
            )}

            {mode === 'create' ? (
              <>
                {options.canCreate && !options.canClaim && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="当前没有可认领的成员，请直接新建本人成员。"
                  />
                )}
                <Form.Item
                  name="name"
                  label="姓名"
                  rules={[{ required: true, message: '请输入姓名' }, { max: 50, message: '姓名最长50个字符' }]}
                >
                  <Input placeholder="请输入本人姓名" maxLength={50} />
                </Form.Item>
                <Form.Item
                  name="gender"
                  label="性别"
                  rules={[{ required: true, message: '请选择性别' }]}
                >
                  <Select placeholder="请选择性别">
                    <Select.Option value="男">男</Select.Option>
                    <Select.Option value="女">女</Select.Option>
                    <Select.Option value="其他">其他</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="birthday" label="生日（可选）">
                  <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isAfter(dayjs(), 'day')} />
                </Form.Item>
              </>
            ) : (
              <Form.Item
                name="claimMemberId"
                label="选择要认领的成员"
                rules={[{ required: true, message: '请选择要认领的成员' }]}
                extra="认领后该成员即为你本人，已被其他账户绑定的成员不可认领。"
              >
                <Select placeholder="请选择成员" options={
                  options.claimable.map((m) => ({
                    value: m.id,
                    label: `${m.name}（${m.gender}${m.birthday ? `，${dayjs(m.birthday).format('YYYY-MM-DD')}` : ''}）`
                  }))
                } />
              </Form.Item>
            )}

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  {mode === 'claim' ? '认领并绑定' : '创建并绑定'}
                </Button>
                <Button onClick={() => setBindOpen(false)}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Row>
  );
};

export default SelfBindingPanel;
