---
description: 按模块编号实现 PROJECT_PLAN 中定义的功能
argument-hint: M02
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

实现模块：$ARGUMENTS

流程：
1. 读取 `docs/PROJECT_PLAN.md` 中该模块的路径、状态和完成标准。
2. 阅读相关源码/测试，确认缺口和依赖；已完成则只处理明确缺失项。
3. 按现有风格做最小实现，必要时补测试。
4. 运行相关测试和 `pnpm build`。
5. 汇报变更文件、验证结果和遗留问题。

约束：遵循 `CLAUDE.md`；不引入范围外依赖；不做无关重构；接口与现有代码/计划一致；不自动提交。
