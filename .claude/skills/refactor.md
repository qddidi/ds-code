---
description: 对指定模块或文件做行为保持的重构
argument-hint: <重构目标或文件路径>
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

重构：$ARGUMENTS

流程：
1. 明确目标、动机和行为边界；会改变外部接口时先等待确认。
2. 阅读相关源码和测试；高风险或覆盖不足时先补行为测试。
3. 小步修改，保持外部行为不变。
4. 运行相关测试和 `pnpm build`。
5. 用 `git diff --stat` 汇总范围，汇报收益、验证结果和风险。

约束：不改外部行为；不做范围外改动；不引入无必要抽象；不自动提交。
