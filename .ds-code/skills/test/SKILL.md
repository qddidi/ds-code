---
name: test
description: 为 ds-code 指定模块或行为编写、补充或修复 vitest 测试
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - Grep
  - Glob
---

用于新增测试、补齐覆盖或修复失效测试。

执行流程：
1. 明确要验证的行为、边界和错误路径。
2. 阅读源码和现有测试，避免重复覆盖；优先复用现有测试风格和 helper。
3. 在 `test/` 下创建或更新对应测试；生产代码只在确实存在 bug 时修改。
4. 运行目标测试，必要时运行相关测试和 `pnpm build`。
5. 汇报新增场景、验证结果和未覆盖原因。

约束：使用 vitest；不使用 snapshot；文件系统测试用临时目录；mock 最小化；不为测试扭曲生产代码；不自动提交。