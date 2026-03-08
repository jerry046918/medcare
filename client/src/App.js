import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuthStatus } from './store/slices/authSlice';
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
import Indicators from './pages/Indicators/Indicators';
import Settings from './pages/Settings/Settings';
import './App.css';

const { Content } = Layout;

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, needsSetup } = useSelector(state => state.auth);

  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);

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
        <Route path="indicators" element={<Indicators />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;