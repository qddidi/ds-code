---
name: dependency
description: 为 ds-code 添加或调整 npm 依赖并完成必要配置
allowed-tools:
  - Read
  - Edit
  - Bash
  - Grep
  - Glob
---

用于新增、替换或移除项目依赖。

执行流程：
1. 明确依赖用途，先检查现有依赖或 Node.js 内置能力是否已满足需求。
2. 判断安装位置：运行时代码用 `dependencies`，测试/构建/类型工具用 `devDependencies`。
3. 对可疑、重复或重型依赖先说明风险并等待确认。
4. 使用 `pnpm add`、`pnpm add -D` 或 `pnpm remove` 修改依赖；必要时补类型包。
5. 做最小配置或代码改动，运行相关测试和 `pnpm build`。
6. 汇报依赖变更、原因、验证结果和残留风险。

约束：优先低依赖方案；不装来路不明或重复能力的包；不自动提交。