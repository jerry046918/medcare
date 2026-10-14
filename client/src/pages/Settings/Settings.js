import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Card, Tabs } from 'antd';
import {
  IdcardOutlined,
  LinkOutlined,
  MergeCellsOutlined,
  SafetyCertificateOutlined,
  ScanOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import AccountPanel from './AccountPanel';
import SelfBindingPanel from './SelfBindingPanel';
import AccessPanel from './AccessPanel';
import InvitePanel from './InvitePanel';
import UsersPanel from './UsersPanel';
import MergePanel from './MergePanel';
import OCRSettings from './OCRSettings';

// v2 设置页：仅作为 Tabs 壳组合各功能面板；
// 邀请码/用户管理/成员合并为 admin 专属（后端同样以 requireAdmin 兜底），按 auth.role 条件渲染。
const Settings = () => {
  const { role } = useSelector(state => state.auth);
  const [activeTab, setActiveTab] = useState('account');

  const items = [
    { key: 'account', label: '账户', icon: <UserOutlined />, children: <AccountPanel /> },
    { key: 'selfBinding', label: '本人绑定', icon: <IdcardOutlined />, children: <SelfBindingPanel /> },
    { key: 'access', label: '我的授权', icon: <LinkOutlined />, children: <AccessPanel /> },
    ...(role === 'admin' ? [
      { key: 'invites', label: '邀请码', icon: <SafetyCertificateOutlined />, children: <InvitePanel /> },
      { key: 'users', label: '用户管理', icon: <TeamOutlined />, children: <UsersPanel /> },
      { key: 'merge', label: '成员合并', icon: <MergeCellsOutlined />, children: <MergePanel /> }
    ] : []),
    { key: 'ocr', label: 'OCR 设置', icon: <ScanOutlined />, children: <OCRSettings /> }
  ];

  return (
    <Card title="系统设置">
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </Card>
  );
};

export default Settings;
