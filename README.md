# ds-code

基于 DeepSeek API 的 AI 编程助手 CLI。在终端中与 AI 对话，完成代码读写、搜索、命令执行等任务。

## 功能

- **Ink 终端 UI** — React 驱动的交互界面，流式输出，实时工具状态显示
- **Agent 循环** — 自动调用工具链完成复杂任务，支持中断 (Ctrl+C)
- **文件操作** — 读取、写入、精确编辑、Glob 匹配、正则搜索
- **Shell 执行** — 授权后执行命令，超时控制，进程中断
- **权限系统** — 只读自动放行，写入需确认，危险命令拒绝
- **上下文压缩** — 长对话自动/手动压缩，保持 token 可控
- **会话持久化** — 自动保存，支持恢复上次对话
- **多模型切换** — deepseek-v4-pro / deepseek-v4-flash / deepseek-reasoner
- **斜杠命令** — 12 个内置命令，输入 `/` 自动补全

## 环境要求

- Node.js >= 20
- DeepSeek API Key（[platform.deepseek.com](https://platform.deepseek.com)）

## 快速开始

```bash
git clone <repo-url>
cd ds
pnpm install

export DEEPSEEK_API_KEY=sk-xxx

pnpm dev                          # 开发模式
pnpm dev -- "fix the bug"        # 带初始 prompt
pnpm dev -- --model reasoner     # 指定模型
pnpm dev -- --resume             # 恢复上次会话
```

构建后运行：

```bash
pnpm build
node dist/bin/ds-code.js
```

## 命令

在交互界面中输入 `/` 触发自动补全：

| 命令 | 说明 |
|------|------|
| `/help` | 查看帮助 |
| `/clear` | 清空对话（含 Agent 内部状态） |
| `/exit` | 退出 |
| `/model` | 交互式切换模型 |
| `/model <name>` | 直接切换（pro / flash / reasoner） |
| `/status` | 模型、token、工具数、会话信息 |
| `/tools` | 列出已注册工具 |
| `/cost` | 当前会话 token 估算 |
| `/compact` | 手动压缩上下文 |
| `/resume` | 恢复上次会话 |
| `/memory` | 查看 system prompt |
| `/doctor` | 检查运行环境 |
| `/version` | 版本号 |

快捷键：

| 按键 | 作用 |
|------|------|
| `Ctrl+C` | 中断当前请求 |
| `Ctrl+D` | 退出 |
| `"""` | 进入/退出多行输入模式 |
| `↑↓` | 补全列表导航 |
| `Enter/Tab` | 选中补全项 |
| `Esc` | 关闭补全 |

## 工具

| 工具 | 说明 | 权限 |
|------|------|------|
| `read_file` | 读取文件，支持行范围 | 自动 |
| `write_file` | 创建或覆写文件 | 需确认 |
| `edit_file` | 精确字符串替换 | 需确认 |
| `glob` | 文件名模式匹配 | 自动 |
| `grep` | 正则内容搜索 | 自动 |
| `list_dir` | 列出目录 | 自动 |
| `bash` | 执行 Shell 命令 | 需确认 |

## 架构

```
用户输入 → Agent → DeepSeek API (stream)
                        │
                  [文本] → 流式渲染到终端
                  [工具] → 执行 → 结果回传 → 继续循环
```

核心模块：

```
src/
├── api/          DeepSeek 客户端、SSE 流解析、重试
├── cli/          Ink 组件（App、MessageList、Autocomplete、ToolCall...）
├── core/         Agent 循环、上下文压缩、会话存储、消息构建
├── tools/        工具实现 + Registry
├── permissions/  权限规则 + Manager
└── utils/        Token 计数、Git、路径工具
```

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发运行（tsx）
pnpm build          # 构建（tsup）
pnpm test           # 测试（vitest）
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
```

## 技术栈

| 类别 | 选型 |
|------|------|
| 运行时 | Node.js 20+, ESM |
| 语言 | TypeScript 5.x |
| 终端 UI | Ink 7 (React) + ink-text-input + ink-spinner |
| 构建 | tsup |
| 测试 | vitest |
| Markdown | marked + marked-terminal |
| 代码高亮 | cli-highlight |
| 文件搜索 | fast-glob |

## License

MIT
