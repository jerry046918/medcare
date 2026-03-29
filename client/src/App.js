import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin, message } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuthStatus, handleAuthExpired, clearLogoutReason } from './store/slices/authSlice';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Dashboard from './pages/Dashboard/Dashboard';
import FamilyMembers from './pages/FamilyMembers/FamilyMembers';
import FamilyMemberDetail from './pages/FamilyMembers/FamilyMemberDetail';
import FamilyMemberEdit from './pages/FamilyMembers/FamilyMemberEdit';
import Reports from './pages/Reports/Reports';
import ReportUpload from './pages/Reports/ReportUpload';
import ReportDetail from './pages/Reports/ReportDetail';
import ReportEdit from './pages/Reports/ReportEdit';
import Settings from './pages/Settings/Settings';
import './App.css';

const { Content } = Layout;

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, needsSetup, logoutReason } = useSelector(state => state.auth);

  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);

  // 监听来自 API 拦截器的认证过期事件
  useEffect(() => {
    const handleAuthLogout = (event) => {
      if (process.env.NODE_ENV !== 'production') console.log('[App] 收到认证过期事件:', event.detail);
      dispatch(handleAuthExpired());
    };

    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [dispatch]);

  // 处理登出原因提示
  useEffect(() => {
    if (logoutReason && !isAuthenticated) {
      if (logoutReason === 'token_expired') {
        message.info('登录已过期，请重新登录');
      }
      dispatch(clearLogoutReason());
    }
  }, [logoutReason, isAuthenticated, dispatch]);

  if (isLoading) {
    return (
      <div className="app-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 如果需要初始化设置
  if (needsSetup) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/register" replace />} />
      </Routes>
    );
  }

  // 如果未认证
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 已认证用户的主应用
  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="family-members" element={<FamilyMembers />} />
        <Route path="family-members/:id" element={<FamilyMemberDetail />} />
        <Route path="family-members/:id/edit" element={<FamilyMemberEdit />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/upload" element={<ReportUpload />} />
        <Route path="reports/:id/edit" element={<ReportEdit />} />
        <Route path="reports/:id" element={<ReportDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
    </ErrorBoundary>
  );
}

export default App;
