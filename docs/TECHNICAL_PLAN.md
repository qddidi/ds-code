# ds-code CLI 技术方案

## 1. 项目概述

ds-code 是一个基于 Node.js 的交互式 AI 编程助手 CLI 工具，功能对标 Claude Code，使用 DeepSeek API 作为底层大模型。用户可以在终端中与 AI 对话，完成代码生成、文件编辑、命令执行、代码分析等软件工程任务。

## 2. 核心功能

| 功能模块 | 说明 |
|---------|------|
| 交互式对话 | 终端内多轮对话，支持上下文管理 |
| 文件读写 | 读取、创建、编辑项目文件 |
| 命令执行 | 在用户授权下执行 shell 命令 |
| 代码搜索 | 支持 glob 匹配和正则搜索 |
| 工具调用 | 基于 DeepSeek function calling 实现工具链 |
| 权限控制 | 危险操作需用户确认 |
| 上下文压缩 | 长对话自动压缩，避免超出 token 限制 |
| 配置管理 | 支持全局/项目级配置 |
| 会话管理 | 支持会话持久化与恢复 |

## 3. 技术选型

| 类别 | 选型 | 理由 |
|------|------|------|
| 运行时 | Node.js >= 20 | LTS 版本，原生支持 ESM |
| 语言 | TypeScript 5.x | 类型安全，开发体验好 |
| CLI 框架 | Ink UI (React) | React 渲染终端 UI，组件化开发 |
| 终端 UI | Ink UI | 轻量，直接控制终端输出 |
| Markdown 渲染 | marked + marked-terminal | 终端内渲染 markdown |
| 代码高亮 | cli-highlight | 终端代码语法高亮 |
| 文件搜索 | fast-glob | 高性能 glob 匹配 |
| 内容搜索 | node child_process (grep) | 兼容性好，跨平台 |
| HTTP 客户端 | node 原生 fetch | 流式请求支持好 |
| 配置管理 | 自研（JSON 文件加载） | 简单直接，无额外依赖 |
| 构建工具 | tsup | 快速打包，零配置 |
| 包管理 | pnpm | 快速、磁盘友好 |
| 测试 | vitest | 快速，兼容 ESM |

## 4. 项目结构

```
ds-code/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── bin/
│   └── ds-code.tsx              # CLI 入口（Ink 渲染）
├── src/
│   ├── index.ts                # 主入口（导出 NAME, VERSION）
│   ├── cli/
│   │   ├── index.ts            # CLI 模块导出
│   │   ├── app.tsx             # Ink 主应用组件（REPL 循环）
│   │   ├── input.ts            # 用户输入解析
│   │   ├── output.ts           # 输出渲染（markdown、工具结果）
│   │   ├── commands.ts         # 斜杠命令定义与匹配
│   │   ├── model.ts            # /model 命令处理
│   │   └── components/         # Ink React 组件
│   │       ├── message-list.tsx       # 消息列表
│   │       ├── streaming-text.tsx     # 流式文本渲染
│   │       ├── status-indicator.tsx   # 加载动画（ink-spinner）
│   │       ├── tool-call.tsx          # 工具调用展示
│   │       ├── autocomplete.tsx       # 斜杠命令 inline 补全
│   │       └── permission-prompt.tsx  # 权限确认交互
│   ├── core/
│   │   ├── agent.ts            # Agent 主循环（对话 + 工具调用）
│   │   ├── context.ts          # 上下文管理与压缩
│   │   ├── message.ts          # 消息构造工具函数
│   │   └── session.ts          # 会话持久化
│   ├── api/
│   │   ├── index.ts            # API 模块导出
│   │   ├── deepseek.ts         # DeepSeek API 客户端
│   │   ├── stream.ts           # SSE 流式解析器
│   │   ├── retry.ts            # 错误重试（指数退避）
│   │   └── types.ts            # API 类型定义
│   ├── tools/
│   │   ├── index.ts            # 工具模块导出
│   │   ├── registry.ts         # 工具注册中心
│   │   ├── types.ts            # 工具接口定义
│   │   ├── read.ts             # 文件读取
│   │   ├── write.ts            # 文件写入
│   │   ├── edit.ts             # 文件编辑（精确替换）
│   │   ├── glob.ts             # 文件搜索
│   │   ├── grep.ts             # 内容搜索
│   │   ├── bash.ts             # 命令执行
│   │   └── list-dir.ts         # 目录列表
│   ├── permissions/
│   │   ├── index.ts            # 权限模块导出
│   │   ├── manager.ts          # 权限管理
│   │   └── rules.ts            # 权限规则定义
│   ├── config/
│   │   ├── index.ts            # 配置模块导出
│   │   ├── loader.ts           # 配置加载
│   │   ├── schema.ts           # 配置 schema
│   │   └── defaults.ts         # 默认配置
│   └── utils/
│       ├── git.ts              # Git 操作
│       └── token-count.ts      # Token 计数估算
├── test/
│   ├── api/
│   │   ├── deepseek.test.ts
│   │   ├── model.test.ts
│   │   └── stream.test.ts
│   ├── cli/
│   │   ├── commands.test.ts
│   │   ├── input.test.ts
│   │   └── output.test.ts
│   ├── core/
│   │   ├── agent.test.ts
│   │   ├── context.test.ts
│   │   ├── message.test.ts
│   │   └── session.test.ts
│   ├── tools/
│   │   ├── bash.test.ts
│   │   ├── edit.test.ts
│   │   ├── glob.test.ts
│   │   ├── grep.test.ts
│   │   ├── list-dir.test.ts
│   │   ├── read.test.ts
│   │   ├── registry.test.ts
│   │   └── write.test.ts
│   ├── permissions/
│   │   └── manager.test.ts
│   ├── config/
│   │   └── loader.test.ts
│   ├── utils/
│   │   ├── git.test.ts
│   │   └── token-count.test.ts
│   ├── integration/
│   │   └── real-deepseek-flow.test.ts
│   ├── fixtures/
│   │   ├── api-responses/
│   │   └── sample-project/
│   └── helpers/
│       ├── mock-api.ts
│       ├── temp-dir.ts
│       ├── test-infrastructure.test.ts
│       └── test-tools.ts
└── README.md
```

## 5. 核心架构设计

### 5.1 Agent 循环

```
用户输入 → 构建消息 → 调用 DeepSeek API → 解析响应
                                                ↓
                                        [文本响应] → 输出给用户
                                        [工具调用] → 执行工具 → 结果回传 → 再次调用 API
```

Agent 采用循环架构：每次 API 返回如果包含 tool_calls，则执行对应工具，将结果追加到消息列表，再次请求 API，直到返回纯文本响应。

### 5.2 OpenAI-compatible API 集成

DeepSeek、OpenAI 与中转站统一走 OpenAI Chat Completions 兼容格式，关键参数：

```typescript
interface ChatClientConfig {
  provider: 'deepseek' | 'openai' | 'custom';
  baseUrl: string;       // https://api.deepseek.com / OpenAI / 中转站地址
  apiKey: string;        // 用户配置
  model: string;         // deepseek-v4-pro / deepseek-reasoner / gpt-4o / 中转站模型别名
  maxTokens: number;     // 输出 token 上限（默认 4096）
  temperature: number;   // 默认 0.2
  timeout: number;       // 请求超时（默认 120000ms）
  stream: boolean;       // 默认 true，流式输出
}
```

- 默认 provider 为 `deepseek`，默认模型 `deepseek-v4-pro`
- `openai` / `custom` provider 允许任意非空模型名，支持 OpenAI-compatible 中转站
- 支持流式输出（SSE），逐字渲染到终端
- 支持 `deepseek-reasoner`（R1）用于复杂推理场景（reasoning_content 单独处理）
- 网络错误和限流自动指数退避重试（src/api/retry.ts）

### 5.3 工具系统

每个工具实现统一接口：

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;       // 参数 schema
  requiresPermission: boolean;  // 是否需要用户确认
  execute(params: unknown): Promise<ToolResult>;
}
```

工具通过 registry 注册，自动生成 function calling 的 tools 参数传给 API。

### 5.4 权限模型

分三级权限：

1. **自动允许** — 只读操作（Read、Glob、Grep）
2. **需确认** — 写操作（Write、Edit）、命令执行（Bash）
3. **始终拒绝** — 用户配置的黑名单

支持通过配置文件预授权特定操作模式（如 `npm test`）。

### 5.5 上下文管理

- 使用自研 token 估算算法（基于字符类型估算，CJK 字符 ~1.5 token/字，英文 ~0.25 token/字符）
- 当上下文接近模型限制（默认 64K 的 80%）时，自动压缩早期对话
- 压缩策略：用当前配置的 OpenAI-compatible API 对早期消息生成摘要，替换原始消息，保留最近 4 条消息

## 6. DeepSeek API 与 Claude API 差异处理

| 差异点 | 处理方式 |
|--------|---------|
| 模型能力差异 | 通过 system prompt 优化指令跟随 |
| function calling 格式 | DeepSeek 兼容 OpenAI 格式，直接适配 |
| 流式响应格式 | SSE 格式，与 OpenAI 一致 |
| token 限制 | deepseek-v4-pro 128K 上下文，8K 输出 |
| 不支持 prompt caching | 通过上下文压缩降低成本 |
| reasoning_content | reasoner 模型返回思维链，需单独存储并回传 API |

## 7. 配置文件设计

全局配置 `~/.ds-code/config.json`：

```json
{
  "provider": "deepseek",
  "apiKey": "sk-xxx",
  "model": "deepseek-v4-pro",
  "baseUrl": "https://api.deepseek.com",
  "temperature": 0.2,
  "maxTokens": 4096,
  "timeout": 120000,
  "permissions": {
    "allowedCommands": ["npm test", "npm run build"]
  }
}
```

项目配置 `.ds-code/settings.json`：

```json
{
  "model": "deepseek-reasoner",
  "permissions": {
    "allowedCommands": ["pnpm dev"]
  }
}
```

## 8. 开发计划

### Phase 1 — 基础骨架 ✅

- [x] 项目初始化（TypeScript + pnpm + tsup）
- [x] DeepSeek API 客户端（流式请求）
- [x] 基础 REPL 交互循环
- [x] 终端 Markdown 渲染
- [x] 基础 Agent 循环（对话 + 工具调用）

### Phase 2 — 工具实现 ✅

- [x] Read / Write / Edit 工具
- [x] Glob / Grep 工具
- [x] Bash 工具（带权限确认）
- [x] ListDir 工具
- [x] 工具注册与自动 schema 生成

### Phase 3 — 体验优化 ✅

- [x] 权限管理系统
- [x] 配置文件加载（全局 + 项目）
- [x] 上下文压缩
- [x] 会话持久化与恢复
- [x] 错误处理与重试

### Phase 4 — 高级功能（部分完成）

- [x] 多模型切换（v4-pro / v4-flash / reasoner）
- [x] Git 集成（分支、状态查询）
- [ ] 子 Agent 支持（并行任务）
- [ ] 插件/技能系统
- [ ] npm 发布与全局安装

## 9. 关键命令

```bash
# 安装
npm install -g @mrdistore/ds-code

# 使用
ds-code                    # 在当前目录启动
ds-code "修复这个 bug"      # 带初始 prompt 启动
ds-code --model reasoner   # 使用 R1 模型
ds-code --resume           # 恢复上次会话

# 开发
pnpm install
pnpm dev                   # 开发模式 (tsx bin/ds-code.tsx)
pnpm build                 # 构建
pnpm test                  # 测试
```

## 10. 风险与应对

| 风险 | 应对 |
|------|------|
| DeepSeek function calling 稳定性 | 增加重试逻辑，对格式错误做容错解析 |
| 模型指令跟随能力不如 Claude | 优化 system prompt，增加 few-shot 示例 |
| API 限流 | 实现指数退避重试 |
| 长上下文性能下降 | 积极压缩，保持有效上下文窗口 |
| 工具调用参数错误 | 参数校验 + 错误反馈给模型重试 |
