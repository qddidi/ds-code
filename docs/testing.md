# 测试计划

## 单元测试

| 模块 | 测试重点 | 测试位置 |
|------|----------|----------|
| API | 请求体、SSE 解析、tool calls、reasoning_content、错误分类、重试、AbortSignal | `test/api/` |
| Agent | 流式回调、工具循环、只读并行、错误工具结果、上下文压缩、最大轮次 | `test/core/agent.test.ts` |
| Context | token 累积、阈值判断、压缩策略、system/最近消息保留 | `test/core/context.test.ts` |
| Session | 创建、保存、恢复、列表、损坏 JSON 容错 | `test/core/session.test.ts` |
| CLI input/options/model/commands/output | 多行解析、命令匹配、选项解析、模型切换、Markdown 渲染 | `test/cli/` |
| Tools | 参数校验、文件读写替换、搜索、bash 输出/超时/中断 | `test/tools/` |
| Permissions | 默认决策、危险命令、白名单、always allow、确认回调 | `test/permissions/` |
| Config | 默认配置、全局/项目合并、无效 JSON、CLI/env 覆盖 | `test/config/` |
| Utils | git 状态、token 估算 | `test/utils/` |

## 集成测试

| 场景 | 验证内容 |
|------|----------|
| 完整对话 | 启动 → 输入问题 → 流式输出 → 退出 |
| 文件编辑 | Agent 调用 read/write/edit 后文件内容正确 |
| 工具权限 | 写入或 bash 前弹出确认，拒绝后不执行 |
| 会话恢复 | 对话保存后 `--resume`/`/resume` 可恢复上下文 |
| 上下文压缩 | 长对话触发压缩后仍可继续对话 |
| 错误恢复 | 模拟 401/429/500/网络错误，验证提示与重试 |
| 多模型 | DeepSeek pro/flash 使用 tools，reasoner 不传 tools，OpenAI/custom 接受任意非空模型 |

## 手动验收

| 场景 | 预期 |
|------|------|
| 首次启动 | 1 秒内显示欢迎信息、版本和输入提示 |
| 普通提问 | 看到 spinner，随后流式输出文本 |
| 工具调用 | 显示工具名和参数摘要，完成后显示结果状态 |
| 权限确认 | 写入/执行前显示 Y/A/N，选择明确生效 |
| Ctrl+C | 当前请求或工具中断，回到输入状态 |
| 多行输入 | `"""` 开始和结束，多行内容作为一条消息发送 |
| `/model` | 可查看/切换模型，DeepSeek 显示选择器 |
| `/status` | 展示当前 provider、模型、session、token 与工具数 |
| 退出再恢复 | `--resume` 恢复最近会话 |
