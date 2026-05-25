# CLAUDE.md — ds-code 项目指引

## 项目简介

ds-code 是 Node.js + TypeScript 交互式 AI 编程助手 CLI，使用 DeepSeek/OpenAI-compatible API。

## 关键文档

按需读取具体文档，不要默认读取 `docs/PROJECT_PLAN.md`；该文件仅作为保留的历史汇总。

- `docs/architecture.md`：技术选型、核心架构、Agent/API/工具/权限/会话/CLI 设计。
- `docs/implementation-status.md`：当前能力、模块状态和完成标准。
- `docs/commands-and-config.md`：开发命令、slash commands、配置文件和环境变量。
- `docs/testing.md`：单元、集成和手动验收测试计划。
- `docs/roadmap-and-risks.md`：后续计划与风险应对。
- `docs/project-structure.md`：目录结构快照。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
```

## 代码规范

- ESM（`"type": "module"`）。
- 文件名用 kebab-case；使用 named export，不用 default export。
- 工具层返回 `ToolResult`；核心层使用 typed error class。
- 不写注释，除非解释非显然约束。
- 不用 `any`；必要时用 `unknown` + 类型守卫。
- 做最小必要改动，不做无关重构或超前抽象。

## 架构要点

- Agent 循环：用户输入 → API 调用 → 响应/工具调用 → 循环到纯文本。
- 工具系统：统一 `Tool` 接口，通过 registry 注册并生成 function calling schema。
- 权限：只读自动允许；写入/执行需确认；危险命令拒绝。
- API：OpenAI chat completions 兼容格式。
