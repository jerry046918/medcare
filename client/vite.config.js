/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // CRA 允许在 .js 中写 JSX;vite 默认仅对 .jsx 启用 jsx loader,
  // 这里为 src 下的 .js 启用,保持源码文件名不变。
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: []
  },
  optimizeDeps: {
    esbuildOptions: {
      // 依赖扫描(dev 预构建)同样需要能解析 src 里的 .js JSX
      loader: { '.js': 'jsx' }
    }
  },
  server: {
    port: 3000,
    proxy: { '/api': 'http://localhost:3001' }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js'
  }
});
