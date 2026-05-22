---
description: 构建并准备发布 ds-code 新版本
argument-hint: <semver版本号>
allowed-tools: Read, Edit, Bash, Grep, Glob
---

准备发布：$ARGUMENTS

流程：
1. 确认版本号符合 semver，并检查工作区状态。
2. 有未提交改动时先汇报并询问是否继续。
3. 运行 `pnpm test` 和 `pnpm build`。
4. 更新 `package.json` version；如有 `CHANGELOG.md`，更新版本说明。
5. 再次运行必要验证。
6. 只有用户明确确认后，才 commit、tag、push 或 publish。

约束：测试/构建失败不发布；不使用 `--no-verify`；不自动提交。
