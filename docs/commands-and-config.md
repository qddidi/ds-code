# 命令与配置

## 开发命令

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Slash commands

| 命令 | 状态 | 行为 |
|------|------|------|
| `/help` | 已实现 | 显示命令列表 |
| `/clear` | 已实现 | 清空 UI 消息并重置 Agent 上下文 |
| `/exit` | 已实现 | 退出程序 |
| `/model [name]` | 已实现 | 查看/切换模型；DeepSeek 无参数时显示模型选择器 |
| `/status` | 已实现 | 显示 provider、base URL、模型、cwd、session、消息数、token 估算、工具数 |
| `/tools` | 已实现 | 列出已注册工具 |
| `/resume` | 已实现 | 恢复最近会话 |
| `/memory` | 已实现 | 显示 system prompt 摘要 |
| `/compact` | 已实现 | 手动压缩上下文 |
| `/cost` | 已实现 | 显示当前会话 token 估算 |
| `/doctor` | 已实现 | 显示 Node、平台、API key、provider、模型、cwd、session |
| `/version` | 已实现 | 显示版本 |

## 配置方案

全局配置：`~/.ds-code/config.json`。

项目配置：`.ds-code/settings.json`。

项目配置覆盖全局配置，CLI 参数覆盖配置文件，环境变量可提供 API key。

```json
{
  "provider": "deepseek",
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-pro",
  "maxTokens": 16384,
  "temperature": 0,
  "timeout": 60000,
  "permissions": {
    "allowedCommands": ["pnpm test", "pnpm build"],
    "allowAllCommands": false
  }
}
```

支持的环境变量：

- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
