---
description: 查看 ds-code 当前模块、测试和构建状态
argument-hint: [关注范围]
allowed-tools: Read, Bash, Grep, Glob
---

查看状态：$ARGUMENTS

流程：
1. 读取 `docs/PROJECT_PLAN.md` 的模块列表、路径和完成标准。
2. 检查关键源码和对应测试是否存在。
3. 运行 `pnpm test --reporter=verbose` 和 `pnpm build`。
4. 输出模块进度表，并列出失败摘要和下一步建议。

约束：状态判断基于当前文件、测试和构建结果；不修改代码。
