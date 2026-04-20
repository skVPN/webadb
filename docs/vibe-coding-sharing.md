# Vibe Coding 实战分享：从零到上线，AI 对话开发 WebADB

> 10 分钟内部分享 | 演讲者：Alex

---

## 开场（1 分钟）

**一句话总结：** 我用 AI 对话的方式，从零开发了一个完整的 Web 产品并部署上线，全程没有手写一行代码。

**产品是什么：** WebADB — 在浏览器中直接控制 Android 手机，还能用 AI 自动执行营销任务。

**在线体验：** ac-sold.com

---

## 什么是 Vibe Coding（1 分钟）

- 不是"让 AI 帮我写个函数"
- 而是**用自然语言描述需求，AI 完成从架构设计到代码实现到部署的全流程**
- 你的角色：产品经理 + 测试员 + 验收者
- AI 的角色：架构师 + 开发者 + 运维

**核心心法：** 描述你要什么，而不是怎么做。

---

## 实战过程回顾（4 分钟）

### 第一阶段：核心功能（对话 1-10）

| 我说的 | AI 做的 |
|--------|---------|
| "写一个基于 WebADB 协议的 HTML" | 调研技术方案，创建 4 个 JS 模块 + HTML |
| "部署到 Cloudflare" | 配置 wrangler.toml，一键部署 |
| "连接不上" | 通过浏览器 MCP 远程调试，定位 ADB server 冲突 |
| "截屏失败" | 分析 exec vs shell 协议差异，加双模式回退 |
| "下拉不支持" | 加 mousedown/mousemove/mouseup 拖拽滑动 |

**关键收获：** 遇到 bug 不要自己猜，让 AI 用浏览器 MCP 直接看控制台日志。

### 第二阶段：产品化（对话 10-25）

| 我说的 | AI 做的 |
|--------|---------|
| "加 Google AdSense" | 一行代码搞定 |
| "生成技术教程" | 基于 codebase-to-course 生成交互式 HTML 教程 |
| "加隐私政策和免责声明" | 所有页面加页脚 + 弹窗，符合 AdSense 审核 |
| "加联系方式和二维码" | 创建 /about 独立页面 |
| "上传 GitHub" | 自动 git init + commit + push |

### 第三阶段：AI 营销功能（对话 25-40）

| 我说的 | AI 做的 |
|--------|---------|
| "接入 LLM 生成营销日历" | 创建 /ai 配置页 + 对话生成 + 日历 UI |
| "用 AutoGLM 控制手机执行" | 截屏→AI分析→ADB操作 的执行循环 |
| "加飞书日报通知" | LLM 生成日报摘要 → Webhook 推送 |
| "多设备数据隔离" | localStorage key 按设备 ID 分区 |
| "日志只保留 3 天" | 按天存储 + 自动清理 |

### 第四阶段：Landing Page 优化（对话 40-50）

| 我说的 | AI 做的 |
|--------|---------|
| "用 ui-ux-pro-max 重构首页" | 生成设计系统 → Bento Grid + Lucide Icons |
| 贴了一段别人的评价 | 全面重构：Hero + Features + Steps + Trust + FAQ + CTA |
| "连接后跳转新页面" | 首页/控制页分离，getDevices 自动重连 |
| "加访问统计" | D1 数据库 + Worker API + /monitor 看板 |

---

## 关键技巧（2 分钟）

### 1. 描述问题，不描述方案

❌ "在 adb-transport.js 的 receive 函数里加个 try-catch"

✅ "连接后截屏失败了，这是控制台日志截图"

### 2. 给 AI 看截图

- 报错截图比文字描述有效 10 倍
- 浏览器 MCP 可以让 AI 直接操作你的浏览器调试

### 3. 迭代式开发

- 不要一次提太多需求
- 每次一个功能点，验证通过再下一个
- 遇到 bug 立刻反馈，不要积累

### 4. 善用 Skills

- `ui-ux-pro-max`：生成设计系统，避免"程序员审美"
- `codebase-to-course`：自动生成技术教程
- `free-tool-strategy`：SEO + 转化优化

### 5. 让 AI 帮你部署和运维

- `npx wrangler deploy` — AI 直接执行
- `git add + commit + push` — AI 一条龙
- D1 数据库创建 + 初始化 — AI 全搞定

---

## 数据成果（1 分钟）

| 指标 | 数据 |
|------|------|
| 开发时间 | 约 4 小时对话 |
| 代码行数 | 3000+ 行（JS + HTML + CSS） |
| 手写代码 | 0 行 |
| 页面数量 | 7 个（首页/控制/AI配置/教程/关于/监控/对话记录） |
| 功能模块 | ADB 协议 / WebUSB / RSA 认证 / AI 日历 / 执行引擎 / 飞书通知 / 访问统计 |
| 部署平台 | Cloudflare Workers + D1 |
| 开源 | github.com/skVPN/webadb |

---

## 适用场景（1 分钟）

**Vibe Coding 适合：**
- 内部工具快速原型
- 个人项目 / Side Project
- 技术调研和 POC
- 落地页和营销页面

**Vibe Coding 不适合：**
- 核心业务系统（需要严格的代码审查）
- 高并发后端服务（需要性能调优）
- 已有大型代码库的维护（上下文太大）

---

## Q&A

**完整对话记录：** ac-sold.com/conversation/webadb%20html%20andorid.md

**想试试？** 推荐从一个小工具开始，比如：
- "帮我写一个 JSON 格式化工具"
- "帮我做一个 Markdown 预览器"
- "帮我搭一个个人博客"

先跑通流程，再做复杂项目。
