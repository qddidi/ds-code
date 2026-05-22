---
description: 优化 ds-code 的 system prompt 或工具描述
argument-hint: <模型行为问题或期望效果>
allowed-tools: Read, Edit, Bash, Grep, Glob
---

优化 prompt/工具描述以解决：$ARGUMENTS

流程：
1. 确认当前偏差、期望行为和复现示例；信息不足先询问。
2. 定位 system prompt、工具 description 或参数 schema。
3. 做最小文本修改，优先清晰短句和明确约束。
4. 补充相关测试；无法自动化时说明手动验证步骤。
5. 运行相关测试和 `pnpm build`。

约束：工具 description 保持简洁；不改变无关工具行为；不自动提交。
