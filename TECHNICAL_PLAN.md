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
| CLI 框架 | 自研（基于 readline/stdin） | Claude Code 风格的交互式 REPL，现有框架不适配 |
| 终端 UI | ink (React for CLI) | 灵活的终端渲染，支持复杂布局 |
| Markdown 渲染 | marked + marked-terminal | 终端内渲染 markdown |
| 代码高亮 | cli-highlight | 终端代码语法高亮 |
| 文件搜索 | fast-glob | 高性能 glob 匹配 |
| 内容搜索 | ripgrep (子进程调用) | 极快的正则搜索 |
| HTTP 客户端 | undici / node 原生 fetch | 流式请求支持好 |
| 配置管理 | cosmiconfig | 标准的配置文件发现 |
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
│   └── ds-code.ts              # CLI 入口
├── src/
│   ├── index.ts                # 主入口
│   ├── cli/
│   │   ├── repl.ts             # REPL 交互循环
│   │   ├── input.ts            # 用户输入处理
│   │   ├── output.ts           # 输出渲染（markdown、代码块）
│   │   └── spinner.ts          # 加载动画
│   ├── core/
│   │   ├── agent.ts            # Agent 主循环（对话 + 工具调用）
│   │   ├── context.ts          # 上下文管理与压缩
│   │   ├── message.ts          # 消息类型定义
│   │   └── session.ts          # 会话持久化
│   ├── api/
│   │   ├── deepseek.ts         # DeepSeek API 客户端
│   │   ├── stream.ts           # 流式响应处理
│   │   └── types.ts            # API 类型定义
│   ├── tools/
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
│   │   ├── manager.ts          # 权限管理
│   │   └── rules.ts            # 权限规则定义
│   ├── config/
│   │   ├── loader.ts           # 配置加载
│   │   ├── schema.ts           # 配置 schema
│   │   └── defaults.ts         # 默认配置
│   └── utils/
│       ├── path.ts             # 路径工具
│       ├── git.ts              # Git 操作
│       └── token-count.ts      # Token 计数估算
├── test/
│   ├── tools/
│   ├── core/
│   └── api/
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

### 5.2 DeepSeek API 集成

DeepSeek API 兼容 OpenAI 格式，关键参数：

```typescript
interface DeepSeekConfig {
  baseUrl: string;       // https://api.deepseek.com
  apiKey: string;        // 用户配置
  model: string;         // deepseek-chat / deepseek-reasoner
  maxTokens: number;     // 输出 token 上限
  temperature: number;   // 默认 0
  stream: boolean;       // 默认 true，流式输出
}
```

- 使用 `deepseek-chat` 作为默认模型（支持 function calling）
- 支持流式输出（SSE），逐字渲染到终端
- 支持 `deepseek-reasoner`（R1）用于复杂推理场景

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

- 使用 tiktoken 或简单估算进行 token 计数
- 当上下文接近模型限制（64K/128K）时，自动压缩早期对话
- 压缩策略：用 DeepSeek 对早期消息生成摘要，替换原始消息

## 6. DeepSeek API 与 Claude API 差异处理

| 差异点 | 处理方式 |
|--------|---------|
| 模型能力差异 | 通过 system prompt 优化指令跟随 |
| function calling 格式 | DeepSeek 兼容 OpenAI 格式，直接适配 |
| 流式响应格式 | SSE 格式，与 OpenAI 一致 |
| token 限制 | deepseek-chat 128K 上下文，8K 输出 |
| 不支持 prompt caching | 通过上下文压缩降低成本 |
| 不支持 extended thinking | 可切换到 deepseek-reasoner 获得思维链 |

## 7. 配置文件设计

全局配置 `~/.ds-code/config.json`：

```json
{
  "apiKey": "sk-xxx",
  "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com",
  "temperature": 0,
  "maxTokens": 8192,
  "permissions": {
    "allowedCommands": ["npm test", "npm run build"],
    "autoApproveRead": true
  }
}
```

项目配置 `.ds-code/settings.json`：

```json
{
  "model": "deepseek-reasoner",
  "systemPrompt": "你是一个专注于本项目的编程助手...",
  "permissions": {
    "allowedCommands": ["pnpm dev"]
  }
}
```

## 8. 开发计划

### Phase 1 — 基础骨架（1-2 周）

- [ ] 项目初始化（TypeScript + pnpm + tsup）
- [ ] DeepSeek API 客户端（流式请求）
- [ ] 基础 REPL 交互循环
- [ ] 终端 Markdown 渲染
- [ ] 基础 Agent 循环（对话 + 工具调用）

### Phase 2 — 工具实现（1-2 周）

- [ ] Read / Write / Edit 工具
- [ ] Glob / Grep 工具
- [ ] Bash 工具（带权限确认）
- [ ] ListDir 工具
- [ ] 工具注册与自动 schema 生成

### Phase 3 — 体验优化（1 周）

- [ ] 权限管理系统
- [ ] 配置文件加载（全局 + 项目）
- [ ] 上下文压缩
- [ ] 会话持久化与恢复
- [ ] 错误处理与重试

### Phase 4 — 高级功能（1-2 周）

- [ ] 多模型切换（chat / reasoner）
- [ ] Git 集成（diff、commit 辅助）
- [ ] 子 Agent 支持（并行任务）
- [ ] 插件/技能系统
- [ ] npm 发布与全局安装

## 9. 关键命令

```bash
# 安装
npm install -g ds-code

# 使用
ds-code                    # 在当前目录启动
ds-code "修复这个 bug"      # 带初始 prompt 启动
ds-code --model reasoner   # 使用 R1 模型

# 开发
pnpm install
pnpm dev                   # 开发模式
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
