---
description: 为指定模块编写或补充 vitest 测试
argument-hint: M07
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

补测试：$ARGUMENTS

流程：
1. 读取 `docs/PROJECT_PLAN.md` 中该模块的测试重点、路径和完成标准。
2. 阅读源码和现有测试，避免重复覆盖。
3. 在 `test/` 下创建或更新对应测试，覆盖缺失边界和错误处理。
4. 运行目标测试，必要时运行相关测试和 `pnpm build`。
5. 汇报新增场景、验证结果和未覆盖原因。

约束：使用 vitest；不使用 snapshot；文件系统测试用临时目录；mock 最小化；不为测试扭曲生产代码；不自动提交。
