---
description: 审查当前分支或最新提交的代码改动
argument-hint: [审查范围说明]
allowed-tools: Read, Bash, Grep, Glob
---

审查：$ARGUMENTS

流程：
1. 查看当前 `git diff`；无未提交改动时审查最新提交。
2. 只审查本次改动涉及的代码。
3. 重点检查正确性、安全性、一致性、性能、错误处理和类型安全。
4. 必要时运行 `pnpm build` 和 `pnpm test`。
5. 按“必须修复 / 建议修复 / 可选优化”输出，包含具体文件行号和修复建议。

约束：没有问题要明确说明；不修改代码，除非用户要求修复。
