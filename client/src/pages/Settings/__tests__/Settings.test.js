import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../../store/slices/authSlice';
import Settings from '../Settings';

// jsdom 缺 antd 需要的浏览器 API（响应式断点/尺寸观测）
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; }
    });
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const baseAuth = (role) => ({
  user: { id: 1, username: 'tester', displayName: '测试员', role },
  role,
  selfMember: { id: 9, name: '测试员本人' },
  token: 'test-token',
  isAuthenticated: true,
  isLoading: false,
  needsSetup: false,
  error: null,
  logoutReason: null
});

const renderSettings = (role) => {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: baseAuth(role) }
  });
  return render(
    <Provider store={store}>
      <Settings />
    </Provider>
  );
};

const renderedTabLabels = () =>
  Array.from(document.querySelectorAll('.ant-tabs-tab')).map((el) => el.textContent);

describe('Settings Tabs 角色门控', () => {
  it('member 账户只有 账户/本人绑定/我的授权/指标管理/OCR 设置 五个 Tab', () => {
    renderSettings('member');
    const labels = renderedTabLabels();
    expect(labels).toEqual(['账户', '本人绑定', '我的授权', '指标管理', 'OCR 设置']);
  });

  it('admin 账户额外看到 邀请码/用户管理/成员合并', () => {
    renderSettings('admin');
    const labels = renderedTabLabels();
    expect(labels).toEqual([
      '账户', '本人绑定', '我的授权', '指标管理', '邀请码', '用户管理', '成员合并', 'OCR 设置'
    ]);
  });

  it('默认激活账户 Tab（懒渲染：非激活面板不挂载）', () => {
    renderSettings('member');
    // antd Tabs 默认懒渲染：仅激活面板挂载。账户面板的修改密码标题应在文档中。
    expect(document.body.textContent).toContain('修改密码');
    // 面板未激活时 AccessPanel 内容不应出现
    expect(document.body.textContent).not.toContain('共享给我的');
  });
});
