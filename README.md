# Multi AI Chat

一个统一的多 AI 聊天应用，支持 ChatGPT、Claude、Gemini 和 OpenAI 兼容 API。

## 功能特性

- 🤖 支持多种 AI 提供商（OpenAI、Anthropic、Google、OpenAI 兼容）
- 💬 流式响应，实时显示 AI 回复
- 📝 本地存储聊天历史
- ⚙️ 灵活的模型配置管理
- 🎨 现代化深色主题界面
- 🔄 会话状态自动保存和恢复

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 配置指南

### 添加 AI 配置

1. 点击侧边栏的「设置」
2. 点击「添加配置」按钮
3. 填写配置信息：
   - 配置名称：自定义名称，如「我的 GPT-4」
   - AI 提供商：选择 OpenAI、Anthropic、Google 或 OpenAI 兼容
   - API 地址：默认使用官方地址，可自定义
   - 模型名称：选择或输入模型名称
   - API Key：输入你的 API 密钥
4. 点击「添加配置」保存

### 支持的提供商

| 提供商 | 默认 API 地址 | 推荐模型 |
|--------|--------------|----------|
| OpenAI | https://api.openai.com/v1 | gpt-4o, gpt-4o-mini |
| Anthropic | https://api.anthropic.com | claude-3-5-sonnet-20241022 |
| Google | https://generativelanguage.googleapis.com/v1beta | gemini-1.5-pro |
| OpenAI 兼容 | 自定义 | 取决于服务商 |

### 使用 OpenAI 兼容 API

许多第三方服务提供 OpenAI 兼容的 API，如：
- Azure OpenAI
- 本地部署的 LLM（如 Ollama、LocalAI）
- 其他云服务商

配置时选择「OpenAI 兼容」，填入对应的 API 地址和密钥即可。

## 使用说明

### 开始聊天

1. 确保已添加至少一个 AI 配置
2. 点击「新建对话」或直接在输入框输入消息
3. 按 Enter 发送消息，Shift+Enter 换行

### 切换模型

点击顶部的模型选择器，选择要使用的配置。

### 查看历史

点击侧边栏的「历史记录」查看所有聊天记录，点击任意记录可继续对话。

### 删除对话

在历史记录页面，将鼠标悬停在对话上，点击删除按钮。

## 技术栈

- React 18 + TypeScript
- Vite 构建工具
- Tailwind CSS 样式
- Zustand 状态管理
- IndexedDB 本地存储
- Vitest 测试框架

## 项目结构

```
src/
├── components/     # UI 组件
│   ├── chat/       # 聊天相关组件
│   ├── layout/     # 布局组件
│   └── settings/   # 设置相关组件
├── lib/            # 核心逻辑
│   ├── adapters/   # API 适配器
│   ├── chat/       # 聊天管理
│   ├── config/     # 配置管理
│   ├── errors/     # 错误处理
│   ├── storage/    # 存储层
│   └── utils/      # 工具函数
├── pages/          # 页面组件
├── store/          # 状态管理
└── types/          # 类型定义
```

## 开发

### 运行测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
```

## 许可证

MIT
