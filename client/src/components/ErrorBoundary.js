import React from 'react';
import { Result, Button } from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('应用错误:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <Result
            status="error"
            title="页面出现错误"
            subTitle="抱歉，页面发生了意外错误。请尝试刷新页面。"
            extra={[
              <Button key="reload" type="primary" onClick={this.handleReload}>刷新页面</Button>,
              <Button key="home" onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}>返回首页</Button>
            ]}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
