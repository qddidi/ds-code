# 优化 Prompt

优化 ds-code 的 system prompt 或工具描述。

## 使用方式

`/optimize-prompt` 然后描述遇到的问题（如模型不按预期调用工具、输出格式不对等）

## 执行步骤

1. 了解当前问题现象（模型行为偏差）
2. 读取相关的 prompt 内容：
   - system prompt: src/core/agent.ts 中的 SYSTEM_PROMPT
   - 工具描述: src/tools/*.ts 中的 description 字段
3. 分析问题原因：
   - 指令不够明确？
   - 缺少示例？
   - 工具描述有歧义？
   - 参数 schema 不够约束？
4. 修改 prompt/description
5. 手动测试修改效果（用实际对话验证）
6. 记录修改原因和效果

## 约束

- DeepSeek 对 prompt 的敏感度与 Claude 不同，需要更明确的指令
- 工具 description 要简洁但无歧义
- 避免过长的 system prompt（浪费 token）
- 修改后要实际测试效果，不能只靠推理
