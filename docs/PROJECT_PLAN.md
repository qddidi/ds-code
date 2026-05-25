# ds-code 技术方案、实施计划与测试

## 1. 项目概述

ds-code 是一个基于 Node.js + TypeScript 的交互式 AI 编程助手 CLI，使用 DeepSeek、OpenAI 或 OpenAI-compatible API。用户可以在终端中与 AI 多轮对话，并通过工具完成代码阅读、文件编辑、命令执行、项目搜索和代码分析。

## 2. 当前实现状态

| 能力 | 状态 | 关键位置 |
|------|------|----------|
| CLI 入口 | 已实现，基于 Ink 渲染 | `bin/ds-code.tsx`, `src/cli/app.tsx` |
| 初始 prompt | 已实现，支持位置参数 | `src/cli/options.ts`, `bin/ds-code.tsx` |
| 流式输出 | 已实现，SSE chunk 增量渲染 | `src/api/deepseek.ts`, `src/core/agent.ts`, `src/cli/app.tsx` |
| Ctrl+C 中断 | 已实现，取消当前请求/工具执行 | `src/cli/app.tsx`, `src/api/deepseek.ts`, `src/tools/bash.ts` |
| Agent 循环 | 已实现，支持工具调用循环与最大轮次限制 | `src/core/agent.ts` |
| 工具系统 | 已实现 Read/Write/Edit/Glob/Grep/ListDir/Bash | `src/tools/` |
| 权限确认 | 已实现写入/执行确认，支持 always allow | `src/permissions/`, `src/cli/components/permission-prompt.tsx` |
| 配置加载 | 已实现全局 + 项目配置合并 | `src/config/` |
| 会话持久化 | 已实现自动保存与恢复 | `src/core/session.ts`, `src/cli/app.tsx` |
| 上下文压缩 | 已实现自动压缩与 `/compact` | `src/core/context.ts`, `src/core/agent.ts` |
| 多模型/多 provider | 已实现 DeepSeek/OpenAI/custom | `src/api/deepseek.ts`, `src/cli/model.ts` |
| Git 集成 | 已实现基础状态/分支/diff 工具函数 | `src/utils/git.ts` |
| Slash commands | 已实现 12 个命令 | `src/cli/commands.ts`, `src/cli/app.tsx` |
| Skills | 已实现 手动与自动触发 | `src/skills/registry.ts.ts`, `src/cli/app.tsx` |
| 测试 | 已覆盖 API、CLI、core、tools、permissions、config、utils | `test/` |
| 子 Agent / 插件系统 | 未实现 | 待规划 |

## 3. 技术选型

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

## 4. 项目结构

```text
ds-code/
├── bin/
│   └── ds-code.tsx
├── src/
│   ├── api/
│   │   ├── deepseek.ts
│   │   ├── index.ts
│   │   ├── retry.ts
│   │   ├── stream.ts
│   │   └── types.ts
│   ├── cli/
│   │   ├── app.tsx
│   │   ├── commands.ts
│   │   ├── input.ts
│   │   ├── model.ts
│   │   ├── options.ts
│   │   ├── output.ts
│   │   └── components/
│   ├── config/
│   │   ├── defaults.ts
│   │   ├── loader.ts
│   │   └── schema.ts
│   ├── core/
│   │   ├── agent.ts
│   │   ├── context.ts
│   │   ├── message.ts
│   │   └── session.ts
│   ├── permissions/
│   │   ├── manager.ts
│   │   └── rules.ts
│   ├── tools/
│   │   ├── bash.ts
│   │   ├── edit.ts
│   │   ├── glob.ts
│   │   ├── grep.ts
│   │   ├── list-dir.ts
│   │   ├── read.ts
│   │   ├── registry.ts
│   │   ├── types.ts
│   │   └── write.ts
│   └── utils/
│       ├── git.ts
│       └── token-count.ts
└── test/
    ├── api/
    ├── cli/
    ├── config/
    ├── core/
    ├── integration/
    ├── permissions/
    ├── tools/
    └── utils/
```

## 5. 核心架构

### 5.1 Agent 循环

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

### 5.2 API 集成

`DeepSeekClient` 统一封装 DeepSeek、OpenAI 与 custom provider，使用 OpenAI Chat Completions 兼容格式。

```typescript
interface ChatClientConfig {
  provider: 'deepseek' | 'openai' | 'custom'
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
}
```

- DeepSeek 模型别名归一化：`pro`/`chat` → `deepseek-v4-pro`，`flash` → `deepseek-v4-flash`，`reasoner` → `deepseek-reasoner`。
- OpenAI/custom provider 允许任意非空模型名。
- `deepseek-reasoner` 不传 tools，并单独处理 `reasoning_content`。
- 流式响应通过 `parseSSEStream()` 解析，支持文本 chunk、reasoning chunk、tool call 增量参数。
- API 请求支持超时与外部 AbortSignal，并通过 `withRetry()` 处理可重试错误。

### 5.3 工具系统

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
| `write_file` | 写入文件 | 需确认 |
| `edit_file` | 精确字符串替换 | 需确认 |
| `glob` | 文件名模式搜索 | 自动允许 |
| `grep` | 内容正则搜索 | 自动允许 |
| `list_dir` | 列目录 | 自动允许 |
| `bash` | 执行 shell 命令 | 需确认/可白名单 |

### 5.4 权限模型

权限分为三类：

1. 自动允许：只读工具。
2. 需确认：文件写入、文件编辑、普通 bash 命令。
3. 直接拒绝：危险 bash 命令。

`PermissionManager` 支持：

- `allowedCommands` 配置白名单。
- 用户本次允许。
- 用户始终允许同类工具或同类 bash 命令，bash 命令会写入项目 `.ds-code/settings.json`。
- 黑名单优先级高于白名单与默认规则。

### 5.5 上下文与会话

- token 估算位于 `src/utils/token-count.ts`。
- 上下文超过阈值后自动压缩早期消息，保留 system message 与最近消息。
- `/compact` 可手动触发压缩。
- `SessionStore` 将消息历史保存到 `~/.ds-code/sessions/`。
- `--resume` 与 `/resume` 支持恢复最近会话。

### 5.6 CLI 交互

CLI 由 Ink `App` 组件驱动：

- 启动后显示版本、提示和输入框。
- 支持 `/` 命令补全，Tab/Enter 选择，Esc 取消。
- 支持 `"""` 独占一行进入/退出多行输入。
- 流式回答进入 streaming 状态，工具调用进入 tool 状态。
- 权限请求通过 `PermissionPrompt` 显示 Y/A/N。
- Ctrl+C 中断当前请求或退出多行输入，Ctrl+D 退出程序。

## 6. Slash commands

| 命令 | 状态 | 行为 |
|------|------|------|
| `/help` | 已实现 | 显示命令列表 |
| `/clear` | 已实现 | 清空 UI 消息并重置 Agent 上下文 |
| `/exit` | 已实现 | 退出程序 |
| `/model [name]` | 已实现 | 查看/切换模型；DeepSeek 无参数时显示模型选择器 |
| `/status` | 已实现 | 显示 provider、base URL、模型、cwd、session、消息数、token 估算、工具数 |
| `/tools` | 已实现 | 列出已注册工具 |
| `/resume` | 已实现 | 恢复最近会话 |
| `/memory` | 已实现 | 显示 system prompt 摘要 |
| `/compact` | 已实现 | 手动压缩上下文 |
| `/cost` | 已实现 | 显示当前会话 token 估算 |
| `/doctor` | 已实现 | 显示 Node、平台、API key、provider、模型、cwd、session |
| `/version` | 已实现 | 显示版本 |

后续优化：`/help` 可扩展为分类帮助，补充快捷键、配置路径和常见用法。

## 7. 配置方案

全局配置：`~/.ds-code/config.json`。

项目配置：`.ds-code/settings.json`。

项目配置覆盖全局配置，CLI 参数覆盖配置文件，环境变量可提供 API key。

```json
{
  "provider": "deepseek",
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-pro",
  "maxTokens": 16384,
  "temperature": 0,
  "timeout": 60000,
  "permissions": {
    "allowedCommands": ["pnpm test", "pnpm build"]
  }
}
```

支持的环境变量：

- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`

## 8. 模块与完成标准

| 编号 | 模块 | 路径 | 状态 | 完成标准 |
|------|------|------|------|----------|
| M01 | 项目基础设施 | `/`, `bin/` | 已完成 | install/build/test/typecheck 基础命令可用 |
| M02 | API 客户端 | `src/api/` | 已完成 | 非流式/流式请求、tool calls、错误类型、重试、中断 |
| M03 | 消息与类型 | `src/core/message.ts`, `src/api/types.ts` | 已完成 | OpenAI-compatible message 与 tool result 构造 |
| M04 | 工具系统框架 | `src/tools/types.ts`, `src/tools/registry.ts` | 已完成 | 注册、schema 导出、参数校验、权限接入 |
| M05 | Agent 核心循环 | `src/core/agent.ts` | 已完成 | 文本响应、工具循环、并行只读工具、轮次上限、压缩 |
| M06 | CLI 交互层 | `src/cli/` | 已完成 | Ink UI、流式输出、命令补全、多行、中断、权限提示 |
| M07 | 文件操作工具 | `src/tools/read.ts`, `write.ts`, `edit.ts` | 已完成 | 读取、写入、精确替换 |
| M08 | 搜索工具 | `src/tools/glob.ts`, `grep.ts`, `list-dir.ts` | 已完成 | glob、grep、目录列表 |
| M09 | Bash 工具 | `src/tools/bash.ts` | 已完成 | stdout/stderr/exitCode/timeout/abort/权限 |
| M10 | 权限系统 | `src/permissions/` | 已完成 | allow/confirm/deny、白名单、always allow、危险命令拒绝 |
| M11 | 配置管理 | `src/config/` | 已完成 | 默认值、全局/项目配置、合并、CLI/env 覆盖 |
| M12 | 上下文管理 | `src/core/context.ts` | 已完成 | token 估算、阈值触发、摘要压缩、消息保留 |
| M13 | 会话管理 | `src/core/session.ts` | 已完成 | 保存、恢复、列表、损坏文件容错 |
| M14 | Git 集成 | `src/utils/git.ts` | 已完成 | repo 检测、branch、status、diff |
| M15 | 多模型支持 | `src/api/deepseek.ts`, `src/cli/model.ts` | 已完成 | provider/model 归一化、runtime 切换、tools 支持判断 |
| M16 | 错误重试 | `src/api/retry.ts` | 已完成 | 网络/限流/服务端错误重试策略 |
| M17 | Token 计数 | `src/utils/token-count.ts` | 已完成 | 字符类型估算、消息估算 |

## 9. 后续实施计划

### P0 — 保持质量门禁

- [ ] 保持 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 通过。
- [ ] 对新工具和新命令同步补测试。
- [ ] 修复发现的实现/文档偏差，不保留过期计划。

### P1 — CLI 体验增强

- [ ] 增强 `/help`：分类显示命令、快捷键、配置路径、常见示例。
- [ ] 优化工具结果摘要：写入行数、替换次数、bash exit code 等在 UI 中显示。
- [ ] 改进错误提示：认证、限流、网络、Abort 分别显示更友好的中文说明。

### P2 — 能力扩展

- [ ] 规划子 Agent 支持：并行只读探索、结果汇总、权限边界。
- [ ] 规划插件/技能系统：加载机制、隔离边界、工具注册协议。
- [ ] 完善发布流程：版本、CHANGELOG、npm publish 前检查。

## 10. 测试计划

### 10.1 单元测试

| 模块 | 测试重点 | 测试位置 |
|------|----------|----------|
| API | 请求体、SSE 解析、tool calls、reasoning_content、错误分类、重试、AbortSignal | `test/api/` |
| Agent | 流式回调、工具循环、只读并行、错误工具结果、上下文压缩、最大轮次 | `test/core/agent.test.ts` |
| Context | token 累积、阈值判断、压缩策略、system/最近消息保留 | `test/core/context.test.ts` |
| Session | 创建、保存、恢复、列表、损坏 JSON 容错 | `test/core/session.test.ts` |
| CLI input/options/model/commands/output | 多行解析、命令匹配、选项解析、模型切换、Markdown 渲染 | `test/cli/` |
| Tools | 参数校验、文件读写替换、搜索、bash 输出/超时/中断 | `test/tools/` |
| Permissions | 默认决策、危险命令、白名单、always allow、确认回调 | `test/permissions/` |
| Config | 默认配置、全局/项目合并、无效 JSON、CLI/env 覆盖 | `test/config/` |
| Utils | git 状态、token 估算 | `test/utils/` |

### 10.2 集成测试

| 场景 | 验证内容 |
|------|----------|
| 完整对话 | 启动 → 输入问题 → 流式输出 → 退出 |
| 文件编辑 | Agent 调用 read/write/edit 后文件内容正确 |
| 工具权限 | 写入或 bash 前弹出确认，拒绝后不执行 |
| 会话恢复 | 对话保存后 `--resume`/`/resume` 可恢复上下文 |
| 上下文压缩 | 长对话触发压缩后仍可继续对话 |
| 错误恢复 | 模拟 401/429/500/网络错误，验证提示与重试 |
| 多模型 | DeepSeek pro/flash 使用 tools，reasoner 不传 tools，OpenAI/custom 接受任意非空模型 |

### 10.3 手动验收

| 场景 | 预期 |
|------|------|
| 首次启动 | 1 秒内显示欢迎信息、版本和输入提示 |
| 普通提问 | 看到 spinner，随后流式输出文本 |
| 工具调用 | 显示工具名和参数摘要，完成后显示结果状态 |
| 权限确认 | 写入/执行前显示 Y/A/N，选择明确生效 |
| Ctrl+C | 当前请求或工具中断，回到输入状态 |
| 多行输入 | `"""` 开始和结束，多行内容作为一条消息发送 |
| `/model` | 可查看/切换模型，DeepSeek 显示选择器 |
| `/status` | 展示当前 provider、模型、session、token 与工具数 |
| 退出再恢复 | `--resume` 恢复最近会话 |

## 11. 开发命令

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 12. 风险与应对

| 风险 | 应对 |
|------|------|
| OpenAI-compatible 中转站行为差异 | provider/custom 模式允许任意模型，错误提示保留响应体摘要 |
| function calling 参数不完整 | registry 参数校验，错误作为 tool result 回传给模型 |
| 长上下文成本和延迟 | 自动压缩 + `/compact` 手动压缩 |
| 误执行危险命令 | rules 黑名单直接拒绝，写入/执行默认确认 |
| reasoner 不支持工具 | `supportsTools()` 判断，reasoner 请求不传 tools |
| UI 状态竞争 | Agent callback 聚合流式内容，工具状态与消息落盘分离 |
