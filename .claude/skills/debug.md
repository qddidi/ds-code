---
description: 诊断并修复 ds-code bug
argument-hint: <问题现象或复现步骤>
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

修复：$ARGUMENTS

流程：
1. 先确认现象、范围和复现条件；信息不足时只问必要问题。
2. 搜索并阅读相关实现，写或补最小复现测试。
3. 先运行测试确认失败，再做最小修复。
4. 运行复现测试、相关测试和 `pnpm build`。
5. 汇报根因、修改点、验证结果和遗留事项。

约束：不盲猜；不做无关重构；不绕过测试、类型或权限检查；不自动提交。
