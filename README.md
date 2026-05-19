# ds-code

基于 DeepSeek API 的 AI 编程助手命令行工具。在终端中与 AI 自然对话，完成文件读写、代码搜索、命令执行等软件工程任务。

## 功能特性

- **交互式 REPL** — 多轮对话，流式响应，终端内 Markdown 渲染
- **文件操作** — 读取文件、创建覆写文件、精确字符串替换编辑
- **代码搜索** — Glob 文件名匹配、正则内容搜索、目录列表
- **命令执行** — 在用户授权下执行 Shell 命令，支持超时控制
- **工具调用** — Agent 循环自动调用工具链完成复杂任务
- **权限系统** — 三级权限模型（自动允许 / 需确认 / 拒绝）
- **上下文管理** — Token 计数跟踪，长对话自动压缩
- **会话管理** — 对话历史持久化保存与恢复
- **多模型支持** — 默认 `deepseek-chat`，可切换至 `deepseek-reasoner` (R1)

## 环境要求

- **Node.js** >= 20
- **pnpm**（开发用）
- **DeepSeek API Key** — 在 [platform.deepseek.com](https://platform.deepseek.com) 获取

## 安装

### 从 npm 安装（即将上线）

```bash
npm install -g ds-code
```

### 从源码安装

```bash
git clone <仓库地址>
cd ds

pnpm install
pnpm build
```

设置 API Key：

```bash
export DEEPSEEK_API_KEY=sk-xxx
```

## 使用方式

### 交互模式

```bash
# 开发模式运行
pnpm dev

# 或构建后运行
node dist/bin/ds-code.js

# 指定模型
pnpm dev -- --model deepseek-reasoner
```

### 内置命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清除对话历史 |
| `/exit` | 退出程序 |

### 可用工具

| 工具 | 说明 |
|------|------|
| `read_file` | 读取文件内容，支持指定行范围 |
| `write_file` | 创建或覆写文件 |
| `edit_file` | 在文件中精确替换字符串 |
| `glob` | 按 glob 模式匹配文件名 |
| `grep` | 按正则表达式搜索文件内容 |
| `list_dir` | 列出目录内容 |
| `bash` | 执行 Shell 命令 |

### 示例对话

```
> 这个项目是做什么的？

AI 会检查项目文件，基于实际代码给出回答。

> 给 src/core/agent.ts 添加错误处理

AI 会读取文件、进行编辑，并解释所做的修改。
```

## 配置

### 全局配置（`~/.ds-code/config.json`）

```json
{
  "apiKey": "sk-xxx",
  "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com",
  "temperature": 0,
  "maxTokens": 8192,
  "permissions": {
    "allowedCommands": ["npm test", "npm run build"],
    "autoApproveRead": true
  }
}
```

### 项目配置（`.ds-code/settings.json`）

```json
{
  "model": "deepseek-reasoner",
  "systemPrompt": "你是一个专注于本项目的 Python 专家...",
  "permissions": {
    "allowedCommands": ["pnpm dev"]
  }
}
```

项目配置覆盖全局配置。首次运行无任何配置文件时，使用内置默认值。

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式运行（tsx）
pnpm build          # 构建生产版本（tsup）
pnpm test           # 运行测试（vitest）
pnpm test:watch     # 监听模式
pnpm lint           # 代码检查
pnpm typecheck      # TypeScript 类型检查
```

## 项目结构

```
ds-code/
├── bin/
│   └── ds-code.ts          # CLI 入口
├── src/
│   ├── index.ts            # 包导出
│   ├── api/                # DeepSeek API 客户端 & SSE 流式解析
│   ├── cli/                # REPL 循环、输入解析、输出渲染
│   ├── config/             # 配置 schema、默认值、加载器
│   ├── core/               # Agent 循环、上下文管理、消息类型、会话
│   ├── permissions/        # 权限规则 & 管理器
│   ├── tools/              # 工具实现 & 注册中心
│   └── utils/              # 路径工具、Git、Token 计数
├── test/
│   ├── unit/               # 单元测试
│   ├── integration/        # 集成测试
│   ├── fixtures/           # 测试固定数据
│   └── helpers/            # 测试辅助工具
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## 架构

```
用户输入 → 构建消息 → 调用 DeepSeek API → 解析响应
                                              │
                                      [文本]   → 渲染输出
                                      [工具]   → 执行工具 → 结果回传 → 循环
```

Agent 采用循环架构：每次 API 返回若包含工具调用，则执行对应工具并将结果追加到消息历史，再次请求 API，直至返回纯文本响应或达到最大循环次数。

## 权限模型

| 级别 | 范围 | 示例 |
|------|------|------|
| **自动允许** | 只读操作 | `read_file`、`glob`、`grep`、`list_dir` |
| **需确认** | 写入操作 & 命令执行 | `write_file`、`edit_file`、`bash` |
| **拒绝** | 用户配置的黑名单 | `rm -rf /`、`chmod 777` |

白名单中的命令（如 `npm test`）可以自动放行。用户对重复操作可选择"始终允许"。

## 技术栈

| 类别 | 选型 |
|------|------|
| 运行时 | Node.js >= 20（ESM） |
| 语言 | TypeScript 5.x |
| 构建 | tsup |
| 测试 | vitest |
| Markdown 渲染 | marked + marked-terminal |
| 代码高亮 | cli-highlight |
| 文件搜索 | fast-glob |
| 终端 UI | chalk、ora |

## API 兼容性

DeepSeek API 兼容 OpenAI Chat Completions 格式，工具调用遵循相同的 `tools` / `tool_calls` 规范。

## 许可证

MIT
