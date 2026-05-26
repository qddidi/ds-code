# 架构概览

## 项目概述

ds-code 是 Node.js + TypeScript 交互式 AI 编程助手 CLI，使用 DeepSeek、OpenAI 或 OpenAI-compatible API。用户可以在终端中与 AI 多轮对话，并通过工具完成代码阅读、文件编辑、命令执行、项目搜索和代码分析。

## 技术选型

| 类别 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node.js >= 20 | ESM 与原生 fetch 支持 |
| 语言 | TypeScript 5.x | 类型安全与可维护性 |
| CLI UI | Ink + React | 组件化终端 UI |
| 输入 | ink-text-input | 单行输入，应用层支持 `"""` 多行模式 |
| Markdown | marked + marked-terminal | 终端 Markdown 渲染 |
| 代码高亮 | cli-highlight | 终端代码块高亮 |
| 文件搜索 | fast-glob | 高性能 glob 匹配 |
| HTTP | Node 原生 fetch | 支持 AbortSignal 与流式响应 |
| 构建 | tsup | ESM 打包 |
| 测试 | vitest | 单元与集成测试 |
| 包管理 | pnpm | 依赖管理 |

## 核心架构

### Agent 循环

```text
用户输入
  → 追加 user message
  → 检查并按需压缩上下文
  → 调用 OpenAI-compatible chat completions stream
  → 渲染文本 / thinking / tool call 状态
  → 如有 tool_calls，执行工具并追加 tool result
  → 再次调用模型，直到返回纯文本或达到最大轮次
```

Agent 维护消息历史并通过 `ContextManager` 跟踪 token 估算。只读工具调用可并行执行，写入或命令类工具按顺序执行以降低副作用风险。

### API 集成

`DeepSeekClient` 统一封装 DeepSeek、OpenAI 与 custom provider，使用 OpenAI Chat Completions 兼容格式。

- DeepSeek 模型别名归一化：`pro`/`chat` → `deepseek-v4-pro`，`flash` → `deepseek-v4-flash`，`reasoner` → `deepseek-reasoner`。
- OpenAI/custom provider 允许任意非空模型名。
- `deepseek-reasoner` 不传 tools，并单独处理 `reasoning_content`。
- 流式响应通过 `parseSSEStream()` 解析，支持文本 chunk、reasoning chunk、tool call 增量参数。
- API 请求支持超时与外部 AbortSignal，并通过 `withRetry()` 处理可重试错误。

### 工具系统

工具实现统一接口，注册到 `ToolRegistry` 后自动转换为 function calling schema。

```typescript
interface Tool {
  name: string
  description: string
  parameters: JSONSchema
  requiresPermission: boolean
  execute(params: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>
}
```

已实现工具：

| 工具 | 功能 | 权限 |
|------|------|------|
| `read_file` | 读取文件，支持 offset/limit | 自动允许 |
| `write_file` | 写入文件，内容变化时返回 git 风格 unified diff | 需确认 |
| `edit_file` | 精确字符串替换，内容变化时返回 git 风格 unified diff | 需确认 |
| `glob` | 文件名模式搜索 | 自动允许 |
| `grep` | 内容正则搜索 | 自动允许 |
| `list_dir` | 列目录 | 自动允许 |
| `bash` | 执行 shell 命令 | 需确认/可白名单 |

### 权限模型

权限分为三类：

1. 自动允许：只读工具。
2. 需确认：文件写入、文件编辑、普通 bash 命令。
3. 直接拒绝：危险 bash 命令。

`PermissionManager` 支持：

- `allowedCommands` 配置白名单。
- 用户本次允许。
- 用户始终允许同类工具或同类 bash 命令，bash 命令会写入项目 `.ds-code/settings.json`。
- 黑名单优先级高于白名单与默认规则。

### 上下文与会话

- token 估算位于 `src/utils/token-count.ts`。
- 上下文超过阈值后自动压缩早期消息，保留 system message 与最近消息。
- `/compact` 可手动触发压缩。
- `SessionStore` 将消息历史保存到 `~/.ds-code/sessions/`。
- `--resume` 与 `/resume` 支持恢复最近会话。

### CLI 交互

CLI 由 Ink `App` 组件驱动：

- 启动后显示版本、提示和输入框。
- 支持 `/` 命令补全，Tab/Enter 选择，Esc 取消。
- 支持 `"""` 独占一行进入/退出多行输入。
- 流式回答进入 streaming 状态，工具调用进入 tool 状态。
- 权限请求通过 `PermissionPrompt` 显示 Y/A/N。
- Ctrl+C 中断当前请求或退出多行输入，Ctrl+D 退出程序。
