# 📱 WebADB Viewer

**无需安装任何软件，直接在浏览器中连接和控制你的 Android 设备。**

👉 **在线使用：[ac-sold.com](https://ac-sold.com)**

基于 WebUSB API 和 ADB 协议的纯前端实现，打开网页即可连接 Android 设备进行截屏、触控、Shell 命令等操作。

![WebADB Viewer](https://img.shields.io/badge/WebADB-Viewer-6c5ce7?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ 功能特性

- 🔌 **USB 直连** — 通过 WebUSB API 直接在浏览器中与 Android 设备通信
- 📸 **实时截屏** — 单次截屏 + 连续截屏模式，实时查看设备画面
- 👆 **触摸控制** — 点击、滑动操作，直接在网页上控制手机
- ⌨️ **ADB Shell** — 内置终端，执行任意 ADB Shell 命令
- 🔐 **RSA 认证** — 完整实现 ADB 认证协议，密钥自动生成并持久化
- 🏠 **虚拟按键** — Home、Back、Recent、Power、音量等快捷按键
- 📚 **交互式教程** — 内置技术教程，深入讲解 WebADB 实现原理
- 🌐 **零安装** — 纯前端实现，无需安装驱动或软件

## 🚀 快速开始

### 方式一：在线使用（推荐）

直接访问 **[ac-sold.com](https://ac-sold.com)** 即可使用，无需任何安装。

### 方式二：本地部署

```bash
# 克隆仓库
git clone https://github.com/skVPN/webadb.git
cd webadb

# 安装依赖
npm install

# 本地预览（Cloudflare Workers 本地模拟）
npx wrangler dev

# 部署到 Cloudflare Workers
npx wrangler deploy
```

### 方式三：本地 HTTPS 服务器（局域网访问）

```bash
# 启动自签名 HTTPS 服务器
node server.js

# 访问 https://你的IP:8443/
```

## 📋 使用前提

1. **Android 设备**开启 USB 调试模式（设置 → 开发者选项 → USB 调试）
2. 使用 **Chromium 内核浏览器**（Chrome、Edge 等）
3. 页面需要 **HTTPS** 环境（在线版本已自带）
4. 如果电脑上运行了 ADB，需要先执行 `adb kill-server`

## 🏗️ 技术架构

```
public/
├── index.html              # 主页面（工具 UI + 交互逻辑）
├── js/
│   ├── adb-protocol.js     # ADB 协议消息构建/解析
│   ├── adb-transport.js    # WebUSB 传输层
│   ├── adb-crypto.js       # RSA 密钥生成 + ADB 公钥格式 + Prehashed 签名
│   └── adb-client.js       # 高层 API（连接、认证、shell、截屏、触控）
├── course/index.html       # 交互式技术教程
├── about/index.html        # 关于页面
└── my-link-qr.png          # 联系二维码
```

### 核心技术点

| 模块 | 说明 |
|------|------|
| **ADB 协议** | 纯 JS 实现 CNXN/AUTH/OPEN/WRTE/CLSE 六种消息 |
| **WebUSB** | 浏览器直接访问 USB 设备，无需驱动 |
| **RSA Prehashed 签名** | 手动实现 PKCS#1 v1.5 签名，解决 Web Crypto 双重哈希问题 |
| **Android 公钥格式** | 实现 524 字节 RSAPublicKey 结构体（含 Montgomery 参数） |
| **操作锁** | 串行化 ADB 命令，避免多路复用消息错位 |

## 📚 教程

内置交互式技术教程，深入讲解每一层的实现原理：

1. **ADB 协议** — 消息结构、六种命令
2. **WebUSB 传输** — 浏览器直连硬件
3. **RSA 认证** — Prehashed 签名、Android 公钥格式
4. **实战** — 截屏（exec vs shell）、触摸坐标转换

访问 [ac-sold.com/course/](https://ac-sold.com/course/) 查看教程。

## 📬 联系方式

- **公司**：钛动科技
- **微信公众号**：codgank
- **GitHub**：[github.com/skVPN/webadb](https://github.com/skVPN/webadb)

## 📄 License

MIT License
