---
description: 为项目添加 npm 依赖并完成必要配置
argument-hint: <包名> [用途说明]
allowed-tools: Read, Edit, Bash, Grep, Glob
---

添加依赖：$ARGUMENTS

流程：
1. 判断用途与安装位置：`dependencies` 或 `devDependencies`。
2. 检查是否已有可复用依赖；可疑包名先提示风险。
3. 用 `pnpm add` 或 `pnpm add -D` 安装，必要时加 `@types/*`。
4. 做最小配置/代码改动，运行 `pnpm build` 和相关测试。
5. 汇报依赖、安装位置、用途和验证结果。

约束：不装来路不明或重复能力的包；优先低依赖；不自动提交。
