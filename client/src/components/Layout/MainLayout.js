import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  Space,
  Typography,
  Tooltip
} from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  HeartOutlined,
  BellOutlined
} from '@ant-design/icons';
import { logout } from '../../store/slices/authSlice';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const breadcrumbMap = {
  '/dashboard': '仪表盘',
  '/family-members': '家庭成员',
  '/reports': '医疗报告',
  '/settings': '系统设置',
};

const getBreadcrumb = (pathname) => {
  const parts = [];
  if (pathname.startsWith('/family-members')) {
    parts.push({ label: '家庭成员', path: '/family-members' });
    if (pathname.includes('/edit')) parts.push({ label: '编辑' });
    else if (pathname.match(/\/family-members\/\d+$/)) parts.push({ label: '详情' });
  } else if (pathname.startsWith('/reports')) {
    parts.push({ label: '医疗报告', path: '/reports' });
    if (pathname.includes('/upload')) parts.push({ label: '上传报告' });
    else if (pathname.includes('/edit')) parts.push({ label: '编辑' });
    else if (pathname.match(/\/reports\/\d+$/)) parts.push({ label: '报告详情' });
  } else {
    const label = breadcrumbMap[pathname];
    if (label) parts.push({ label });
  }
  return parts;
};

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector(state => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/settings')
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout
    }
  ];

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: '/family-members',
      icon: <TeamOutlined />,
      label: '家庭成员'
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: '医疗报告'
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置'
    }
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const getSelectedKeys = () => {
    const pathname = location.pathname;
    for (const item of menuItems) {
      if (pathname === item.key || (item.key !== '/' && pathname.startsWith(item.key))) {
        return [item.key];
      }
    }
    return ['/dashboard'];
  };

  const breadcrumbs = getBreadcrumb(location.pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        collapsedWidth={72}
        style={{
          background: 'linear-gradient(180deg, #0f172a, #1e293b)',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10
        }}
      >
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <HeartOutlined style={{ fontSize: 16, color: '#fff' }} />
          </div>
          {!collapsed && (
            <Text strong style={{
              color: '#f1f5f9',
              fontSize: 16,
              marginLeft: 12,
              fontWeight: 700,
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap'
            }}>
              MedCare
            </Text>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            border: 'none',
            marginTop: 8,
            padding: '0 4px'
          }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 72 : 220, transition: 'margin-left 0.2s ease' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 9,
          height: 56,
          lineHeight: '56px'
        }}>
          <Space size="middle">
            <Tooltip title={collapsed ? '展开菜单' : '收起菜单'} placement="right">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: '16px', color: '#64748b' }}
              />
            </Tooltip>
            <div className="breadcrumb-nav">
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>首页</span>
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx}>
                  {' / '}
                  {crumb.path ? (
                    <span style={{ cursor: 'pointer' }} onClick={() => navigate(crumb.path)}>{crumb.label}</span>
                  ) : (
                    <span className="current">{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          </Space>

          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            arrow
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                style={{
                  backgroundColor: '#3b82f6',
                  fontSize: 14,
                  fontWeight: 600
                }}
                size={32}
              >
                {user?.username?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Text style={{ color: '#334155', fontSize: 14 }}>{user?.username}</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{
          padding: 24,
          background: '#f8fafc',
          minHeight: 'calc(100vh - 56px)',
          overflow: 'auto'
        }}>
          <div className="page-fade-in">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
