---
name: tool
description: 为 ds-code 添加或修改 Tool，并补充注册、权限和测试
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - Grep
  - Glob
---

用于实现新的 Agent 工具或调整已有工具行为。

执行流程：
1. 阅读 `src/tools/types.ts`、工具 registry、权限逻辑和相近工具实现。
2. 明确工具边界、输入 schema、输出 `ToolResult` 和是否需要权限。
3. 在 `src/tools/` 做最小实现并注册；写入、删除、执行命令或影响外部状态的工具必须要求确认。
4. 增加或更新 `test/tools/` 测试，覆盖成功、参数错误、权限和关键边界。
5. 仅当用户可见工具列表或测试计划变化时更新相关文档。
6. 运行目标测试、相关测试和 `pnpm build`。

约束：参数使用 OpenAI-compatible JSON Schema；工具层错误返回 `ToolResult`；不使用 `any`；不自动提交。