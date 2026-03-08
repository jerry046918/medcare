import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Space,
  Spin,
  Alert,
  message
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchFamilyMemberDetail,
  updateFamilyMember,
  clearError
} from '../../store/slices/familyMemberSlice';

const { Option } = Select;

const FamilyMemberEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  
  const { currentMember, isLoading, isUpdating, error } = useSelector(
    state => state.familyMembers
  );

  useEffect(() => {
    if (id) {
      dispatch(fetchFamilyMemberDetail(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (currentMember) {
      form.setFieldsValue({
        ...currentMember,
        birthday: currentMember.birthday ? dayjs(currentMember.birthday) : null
      });
    }
  }, [currentMember, form]);

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleBack = () => {
    navigate(`/family-members/${id}`);
  };

  const handleSubmit = async (values) => {
    try {
      const formData = {
        ...values,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : null
      };

      await dispatch(updateFamilyMember({ id, data: formData })).unwrap();
      message.success('更新成功');
      navigate(`/family-members/${id}`);
    } catch (error) {
      // 错误已在Redux中处理
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && !currentMember) {
    return (
      <Alert
        message="加载失败"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={handleBack}>
            返回详情
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
            >
              返回
            </Button>
            <span>编辑家庭成员</span>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 600 }}
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
                icon={<SaveOutlined />}
                loading={isUpdating}
              >
                保存更改
              </Button>
              <Button onClick={handleBack}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default FamilyMemberEdit;