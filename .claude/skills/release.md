# 发布版本

构建并发布 ds-code 的新版本。

## 使用方式

`/release <版本号>`，例如 `/release 0.1.0`

## 执行步骤

1. 确认当前分支干净（无未提交改动）
2. 运行完整测试套件 `pnpm test`
3. 运行构建 `pnpm build`
4. 更新 package.json 中的 version 字段
5. 更新 CHANGELOG.md（如果存在）
6. 创建 git commit: `chore: release v<版本号>`
7. 创建 git tag: `v<版本号>`
8. 提示用户确认后执行：
   - `git push origin main --tags`
   - `pnpm publish`

## 约束

- 测试不通过不允许发布
- 构建失败不允许发布
- push 和 publish 必须等用户确认
- 遵循 semver 规范
