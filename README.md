# ds-code

基于 DeepSeek、OpenAI 或 OpenAI-compatible API 的 AI 编程助手 CLI。在终端中与 AI 对话，完成代码读写、搜索、命令执行等任务。

## 安装

```bash
npm install -g @mrdistore/ds-code
```

## 配置

配置优先级为：CLI 参数 > 项目配置 > 全局配置 > 环境变量/默认值。

配置文件位置：

- 全局配置：`~/.ds-code/config.json`
- 项目配置：当前项目下的 `.ds-code/settings.json`

设置 API Key：

```bash
# DeepSeek
export DEEPSEEK_API_KEY=sk-xxx

# OpenAI
export OPENAI_API_KEY=sk-xxx
```

Windows PowerShell：

```powershell
$env:DEEPSEEK_API_KEY="sk-xxx"
$env:OPENAI_API_KEY="sk-xxx"
```

OpenAI-compatible 中转站可通过配置文件或 CLI 指定：

```json
{
  "provider": "custom",
  "baseUrl": "https://relay.example.com",
  "apiKey": "sk-xxx",
  "model": "openai/gpt-4o"
}
```

完整配置示例：

```json
{
  "provider": "deepseek",
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-pro",
  "maxTokens": 4096,
  "temperature": 0.2,
  "timeout": 120000,
  "permissions": {
    "allowedCommands": [
      "git status",
      "pnpm test"
    ]
  }
}
```

常用字段：

| 字段 | 说明 |
|------|------|
| `provider` | API 提供方：`deepseek`、`openai` 或 `custom` |
| `apiKey` | API Key；也可通过环境变量 `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` 设置 |
| `baseUrl` | API 基础地址，使用中转站时设置 |
| `model` | 模型名称，如 `deepseek-v4-pro`、`deepseek-reasoner`、`gpt-4o` |
| `maxTokens` | 单次响应最大 token 数 |
| `temperature` | 采样温度 |
| `timeout` | 请求超时时间，单位毫秒 |
| `permissions.allowedCommands` | 预允许执行的 Bash 命令，支持以 `*` 结尾的前缀匹配 |

`AGENTS.md` 可放在项目目录或父目录中，用于提供项目级 AI 指令；启动时会读取离当前目录最近的一个。

## 使用

```bash
# 启动交互式对话
ds-code

# 带初始 prompt 启动
ds-code "帮我看看这个项目的结构"

# 指定模型
 ds-code --model reasoner

# 使用 OpenAI
 ds-code --provider openai --model gpt-4o

# 使用 OpenAI-compatible 中转站
 ds-code --provider custom --base-url https://relay.example.com --model openai/gpt-4o

# 恢复上次会话
ds-code --resume
```

## 功能

- **交互式终端 UI** — 流式输出，实时工具调用状态显示
- **Agent 工具链** — 自动读写文件、搜索代码、执行命令，完成复杂任务
- **权限控制** — 只读操作自动放行，写入和命令执行需确认
- **多模型切换** — DeepSeek 模型、OpenAI GPT 模型、OpenAI-compatible 中转站模型
- **上下文管理** — 长对话自动压缩，会话持久化保存与恢复
- **斜杠命令** — 输入 `/` 自动补全，12 个内置命令

## 命令

在对话中输入 `/` 触发自动补全：

| 命令 | 说明 |
|------|------|
| `/help` | 查看帮助 |
| `/clear` | 清空对话 |
| `/exit` | 退出 |
| `/model` | 交互式切换模型 |
| `/model <name>` | 直接切换（如 reasoner / gpt-4o / 中转站模型别名） |
| `/status` | 查看状态信息 |
| `/tools` | 列出可用工具 |
| `/cost` | token 用量估算 |
| `/compact` | 手动压缩上下文 |
| `/resume` | 恢复上次会话 |
| `/doctor` | 检查运行环境 |
| `/version` | 版本号 |

## 快捷键

| 按键 | 作用 |
|------|------|
| `Ctrl+C` | 中断当前请求 |
| `Ctrl+D` | 退出 |
| `"""` | 进入/退出多行输入 |
| `↑↓` | 补全列表导航 |
| `Enter/Tab` | 选中补全项 |
| `Esc` | 关闭补全 |

## 内置工具

| 工具 | 说明 | 权限 |
|------|------|------|
| `read_file` | 读取文件，支持行范围 | 自动 |
| `write_file` | 创建或覆写文件 | 需确认 |
| `edit_file` | 精确字符串替换 | 需确认 |
| `glob` | 文件名模式匹配 | 自动 |
| `grep` | 正则内容搜索 | 自动 |
| `list_dir` | 列出目录 | 自动 |
| `bash` | 执行 Shell 命令 | 需确认 |

## 环境要求

- Node.js >= 20
- DeepSeek API Key、OpenAI API Key 或 OpenAI-compatible 中转站 Key

## 开发

```bash
git clone https://github.com/qddidi/ds-code.git
cd ds-code
pnpm install

pnpm dev            # 开发运行
pnpm build          # 构建
pnpm test           # 测试
pnpm lint           # 代码检查
pnpm typecheck      # 类型检查
```

## License

MIT
