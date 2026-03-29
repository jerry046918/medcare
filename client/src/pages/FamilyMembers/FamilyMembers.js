import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Tag,
  Avatar
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  clearError
} from '../../store/slices/familyMemberSlice';

const { Option } = Select;

const FamilyMembers = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, isLoading, isCreating, isUpdating, isDeleting, error } = useSelector(
    state => state.familyMembers
  );

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchFamilyMembers());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleAdd = () => {
    setEditingMember(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    form.setFieldsValue({
      ...member,
      birthday: member.birthday ? dayjs(member.birthday) : null
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await dispatch(deleteFamilyMember(id)).unwrap();
      message.success('删除成功');
    } catch (error) {
      // 错误已在Redux中处理
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const formData = {
        ...values,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : null
      };

      if (editingMember) {
        await dispatch(updateFamilyMember({ id: editingMember.id, data: formData })).unwrap();
        message.success('更新成功');
      } else {
        await dispatch(createFamilyMember(formData)).unwrap();
        message.success('创建成功');
      }
      
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      // 错误已在Redux中处理
    }
  };

  const handleViewDetail = (member) => {
    navigate(`/family-members/${member.id}`);
  };

  const columns = [
    {
      title: '头像',
      dataIndex: 'avatar',
      key: 'avatar',
      width: 80,
      render: (_, record) => (
        <Avatar 
          size={40} 
          icon={<UserOutlined />} 
          style={{ backgroundColor: record.gender === '男' ? '#1890ff' : '#f759ab' }}
        >
          {record.name.charAt(0)}
        </Avatar>
      )
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: 'bold' }}>{text}</span>
          <Tag color={record.gender === '男' ? 'blue' : 'pink'}>{record.gender}</Tag>
        </Space>
      )
    },
    {
      title: '关系',
      dataIndex: 'relationship',
      key: 'relationship'
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      render: (age) => age ? `${age}岁` : '-'
    },
    {
      title: '身高',
      dataIndex: 'height',
      key: 'height',
      render: (height) => height ? `${height}cm` : '-'
    },
    {
      title: '体重',
      dataIndex: 'weight',
      key: 'weight',
      render: (weight) => weight ? `${weight}kg` : '-'
    },
    {
      title: 'BMI',
      dataIndex: 'bmi',
      key: 'bmi',
      render: (bmi) => {
        if (!bmi) return '-';
        const bmiValue = parseFloat(bmi);
        let color = 'default';
        if (bmiValue < 18.5) color = 'blue';
        else if (bmiValue < 24) color = 'green';
        else if (bmiValue < 28) color = 'orange';
        else color = 'red';
        return <Tag color={color}>{bmi}</Tag>;
      }
    },
    {
      title: '报告数量',
      dataIndex: 'reportCount',
      key: 'reportCount',
      render: (count) => (
        <Tag color={count > 0 ? 'green' : 'default'}>
          {count || 0}份
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个家庭成员吗？"
            description="删除后无法恢复，且必须先删除相关的医疗报告。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              loading={deletingId === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="家庭成员管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加成员
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={list}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      <Modal
        title={editingMember ? '编辑家庭成员' : '添加家庭成员'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="gender"
            label="性别"
            rules={[{ required: true, message: '请选择性别' }]}
          >
            <Select placeholder="请选择性别">
              <Option value="男">男</Option>
              <Option value="女">女</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="relationship"
            label="关系"
            rules={[{ required: true, message: '请输入与管理员的关系' }]}
          >
            <Select placeholder="请选择关系">
              <Option value="本人">本人</Option>
              <Option value="配偶">配偶</Option>
              <Option value="父亲">父亲</Option>
              <Option value="母亲">母亲</Option>
              <Option value="儿子">儿子</Option>
              <Option value="女儿">女儿</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="birthday"
            label="生日"
          >
            <DatePicker 
              placeholder="请选择生日" 
              style={{ width: '100%' }}
              disabledDate={(current) => current && current > dayjs().endOf('day')}
            />
          </Form.Item>

          <Form.Item
            name="height"
            label="身高 (cm)"
          >
            <InputNumber
              placeholder="请输入身高"
              min={0}
              max={300}
              precision={1}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="weight"
            label="体重 (kg)"
          >
            <InputNumber
              placeholder="请输入体重"
              min={0}
              max={500}
              precision={1}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isCreating || isUpdating}
              >
                {editingMember ? '更新' : '创建'}
              </Button>
              <Button
                onClick={() => {
                  setIsModalVisible(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FamilyMembers;