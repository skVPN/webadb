# WebADB Viewer

基于 WebUSB + ADB 协议的网页端 Android 设备查看器。

## 功能

- USB 连接 Android 设备（通过 WebUSB API）
- 查看设备基本信息
- 实时截屏查看（连续截屏模式）
- 执行 ADB Shell 命令
- 触摸控制（点击、滑动）

## 使用前提

1. Android 设备开启 USB 调试模式
2. 使用 Chromium 内核浏览器（Chrome、Edge 等）
3. 页面需要 HTTPS 或 localhost 环境

## 本地开发

```bash
# 安装依赖
npm install

# 本地预览
npx wrangler dev
```

## 部署到 Cloudflare

```bash
npx wrangler deploy
```

## 技术栈

- WebUSB API - 浏览器直接访问 USB 设备
- ADB 协议 - 纯 JavaScript 实现
- Cloudflare Workers - 静态站点托管
