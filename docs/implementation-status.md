# 实现状态

## 当前能力

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
| 测试 | 已覆盖 API、CLI、core、tools、permissions、config、utils | `test/` |
| 子 Agent / 插件系统 | 未实现 | 待规划 |

## 模块与完成标准

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
