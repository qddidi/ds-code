---
description: 为 ds-code 添加一个新 Tool 并补充测试和文档
argument-hint: <工具名称> <功能描述>
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

添加工具：$ARGUMENTS

流程：
1. 阅读 `src/tools/types.ts`、`registry.ts` 和同类工具。
2. 在 `src/tools/` 最小实现并注册工具，必要时更新导出。
3. 增加 `test/tools/<工具名>.test.ts`，覆盖成功、参数错误、边界和权限。
4. 如工具会写入、删除、执行命令或影响外部状态，设置 `requiresPermission: true`。
5. 仅在工具列表或测试计划变化时更新 `docs/PROJECT_PLAN.md`。
6. 运行 `pnpm build` 和相关测试。

约束：参数用 OpenAI-compatible JSON Schema；工具层错误返回 `ToolResult`；不自动提交。
