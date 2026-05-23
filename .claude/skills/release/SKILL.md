---
name: release
description: 构建并准备发布 ds-code 新版本
allowed-tools:
  - Read
  - Edit
  - Bash
  - Grep
  - Glob
---

用于版本发布前的检查、版本号更新和发布准备。

执行流程：
1. 确认目标版本符合 semver，并检查工作区状态。
2. 如果存在未提交改动，先汇报并询问是否继续。
3. 运行 `pnpm test` 和 `pnpm build`，失败则停止发布准备并修复或汇报。
4. 更新 `package.json` version；如存在 `CHANGELOG.md`，按现有格式更新版本说明。
5. 再次运行必要验证。
6. 只有用户明确确认后，才 commit、tag、push 或 publish。

约束：测试或构建失败不发布；不使用 `--no-verify`；不自动提交、打 tag、push 或 publish。