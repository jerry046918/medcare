/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA:manifest + Service Worker(precache app shell /api 不缓存)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'MedCare 家庭健康',
        short_name: 'MedCare',
        description: '家庭健康管理与报告追踪',
        theme_color: '#3b82f6',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        // API 导航(/api/*)不允许回落到 SPA 壳,避免离线时返回 HTML 掩盖网络错误
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: /\/api\//, handler: 'NetworkOnly' } // 健康数据不做离线缓存
        ]
      }
    })
  ],
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
