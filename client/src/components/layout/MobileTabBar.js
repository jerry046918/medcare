import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  FileTextOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';

const ACTIVE_COLOR = '#3b82f6';
const INACTIVE_COLOR = '#64748b';

// antd 5.x 未提供 TabBar(属于 antd-mobile);这里按同一交互契约
// (activeKey 解析 + onChange 导航 + 中央凸起上传按钮)自行实现底部标签栏。
export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = ['/', '/dashboard', '/reports', '/family-members', '/settings', '/upload']
    .filter((p) => location.pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0] || '/dashboard';

  const handleChange = (key) => {
    if (key === '__upload') {
      navigate('/upload/quick');
    } else {
      navigate(key);
    }
  };

  const renderItem = (key, icon, title) => {
    const active = activeKey === key;
    const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
    return (
      <button
        type="button"
        key={key}
        aria-label={title}
        aria-current={active ? 'page' : undefined}
        onClick={() => handleChange(key)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1, color }}>{icon}</span>
        <span style={{ fontSize: 10, lineHeight: 1.2, color }}>{title}</span>
      </button>
    );
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: '#fff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'stretch',
        height: 50,
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      {renderItem('/dashboard', <DashboardOutlined />, '首页')}
      {renderItem('/reports', <FileTextOutlined />, '报告')}
      <button
        type="button"
        aria-label="上传"
        onClick={() => handleChange('__upload')}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            marginTop: -18,
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(6,182,212,0.4)'
          }}
        >
          <PlusOutlined style={{ color: '#fff', fontSize: 20 }} />
        </div>
      </button>
      {renderItem('/family-members', <TeamOutlined />, '成员')}
      {renderItem('/settings', <UserOutlined />, '我的')}
    </nav>
  );
}
