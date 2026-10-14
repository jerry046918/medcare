import React, { useEffect, useState } from 'react';
import { Modal, Typography } from 'antd';

const KEY = 'medcare_install_hint_dismissed';

// jsdom/老浏览器兜底:matchMedia 可能缺失;localStorage 在隐私模式下可能抛错
const isStandalone = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const standaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari 加入主屏幕后暴露 navigator.standalone
  const iosStandalone = Boolean(window.navigator && window.navigator.standalone);
  return standaloneDisplay || iosStandalone;
};

const readDismissed = () => {
  try {
    return Boolean(window.localStorage.getItem(KEY));
  } catch (e) {
    return false;
  }
};

const persistDismissed = () => {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch (e) {
    /* 忽略:无法持久化时仅本次会话生效 */
  }
};

export default function InstallPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone() || readDismissed()) return undefined;
    const t = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const close = () => { persistDismissed(); setOpen(false); };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <Modal open={open} onCancel={close} onOk={close} okText="知道了" cancelText="不再提示" cancelButtonProps={{ onClick: close }} title="安装到主屏幕">
      <Typography.Paragraph>
        {isIOS
          ? '在 Safari 底部分享菜单中选择「添加到主屏幕」，即可像 App 一样快速上传报告。'
          : '可通过浏览器地址栏的安装图标，把 MedCare 添加到桌面，快速上传报告。'}
      </Typography.Paragraph>
    </Modal>
  );
}
