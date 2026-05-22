# 后续计划与风险

## 后续实施计划

### P0 — 保持质量门禁

- [ ] 保持 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 通过。
- [ ] 对新工具和新命令同步补测试。
- [ ] 修复发现的实现/文档偏差，不保留过期计划。

### P1 — CLI 体验增强

- [ ] 增强 `/help`：分类显示命令、快捷键、配置路径、常见示例。
- [ ] 优化工具结果摘要：写入行数、替换次数、bash exit code 等在 UI 中显示。
- [ ] 改进错误提示：认证、限流、网络、Abort 分别显示更友好的中文说明。

### P2 — 能力扩展

- [ ] 规划子 Agent 支持：并行只读探索、结果汇总、权限边界。
- [ ] 规划插件/技能系统：加载机制、隔离边界、工具注册协议。
- [ ] 完善发布流程：版本、CHANGELOG、npm publish 前检查。

## 风险与应对

| 风险 | 应对 |
|------|------|
| OpenAI-compatible 中转站行为差异 | provider/custom 模式允许任意模型，错误提示保留响应体摘要 |
| function calling 参数不完整 | registry 参数校验，错误作为 tool result 回传给模型 |
| 长上下文成本和延迟 | 自动压缩 + `/compact` 手动压缩 |
| 误执行危险命令 | rules 黑名单直接拒绝，写入/执行默认确认 |
| reasoner 不支持工具 | `supportsTools()` 判断，reasoner 请求不传 tools |
| UI 状态竞争 | Agent callback 聚合流式内容，工具状态与消息落盘分离 |
