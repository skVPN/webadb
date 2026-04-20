# 📱 即插即用的安卓 AI 营销日历

> **在浏览器中直接控制 Android 设备 — 无需安装软件、无需 ROOT、无需部署环境，跨平台兼容。**
> **只需一根数据线和 Chrome 浏览器，即可轻松上手。**

👉 **在线使用：[ac-sold.com](https://ac-sold.com)**

基于 WebUSB + ADB 协议 + AI 大模型，实现从设备连接、截屏控制到 AI 自动化营销的完整链路。

![WebADB Viewer](https://img.shields.io/badge/WebADB-AI营销日历-6c5ce7?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🔌 两步上手

**第一步：开启开发者模式**
> 设置 → 关于手机 → 连续点击"软件版本"7次

**第二步：连接使用**
> USB 连接电脑 → 打开 [ac-sold.com](https://ac-sold.com) → 点击"连接设备"按钮

就这么简单，无需安装任何东西。

---

## ✨ 功能特性

- 🔌 **即插即用** — 一根数据线 + Chrome 浏览器，无需安装驱动或软件
- 🤖 **AI 营销日历** — 对话式生成营销计划，AutoGLM 自动控制手机执行
- 📸 **实时截屏** — 单次截屏 + 连续截屏模式，实时查看设备画面
- 👆 **触摸控制** — 点击、滑动操作，直接在网页上控制手机
- ⌨️ **ADB Shell** — 内置终端，执行任意 ADB Shell 命令
- 📅 **智能日历** — AI 生成营销任务，按日历自动调度执行
- 🔔 **飞书通知** — 每日自动生成执行日报并推送到飞书群
- 🌐 **跨平台** — Windows / macOS / Linux / ChromeOS 均可使用

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

## 💬 VibeCoding 对话记录

本项目完全通过 AI 对话（VibeCoding）方式开发。完整的开发对话记录已公开，你可以看到从零开始构建 WebADB 的每一步思考和调试过程：

👉 [查看 VibeCoding 对话记录](https://ac-sold.com/conversation/webadb%20html%20andorid.md)

## 🎮 WebADB vs Android 群控

| 方案 | 原理 | 适用场景 |
|------|------|----------|
| **WebADB（本项目）** | WebUSB + ADB 协议，浏览器直连本地 USB 设备 | 单设备调试、快速截屏、Shell 命令、开发测试 |
| **Android 群控** | 基于 [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy) 的视频流转发 | 多设备批量管理、远程控制、自动化运营 |

WebADB 的优势是**零安装、即开即用**，适合开发者快速调试单台设备。而 Android 群控方案基于 scrcpy 做视频流转发，适合需要同时管理多台设备的场景。

我在 scrcpy 群控的基础上增加了 **AI 日历功能**，可以智能管理多设备的任务调度：

![AI 日历功能](https://ac-sold.com/images/image.png)

![群控面板](https://ac-sold.com/images/fda7d62f-52b2-4029-a39f-65e166527f90.png)

![设备管理](https://ac-sold.com/images/47d6f455-0455-4c34-96f5-5d7e0b7e197f.png)

## 🎯 PM Skills 评估工具

我们提供了一套完整的产品经理技能评估框架，涵盖 A/B 测试分析、用户画像、竞品分析等 50+ 专业技能模板。

👉 **关注微信公众号「codgank」回复"PM"即可免费获取完整评估文档**

## 📬 联系方式

- **Employed at**：Tec-Do
- **微信公众号**：codgank
- **GitHub**：[github.com/skVPN/webadb](https://github.com/skVPN/webadb)

## 📄 License

MIT License
