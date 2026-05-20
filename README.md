# ds-code

基于 DeepSeek API 的 AI 编程助手 CLI。在终端中与 AI 对话，完成代码读写、搜索、命令执行等任务。

## 安装

```bash
npm install -g @mrdistore/ds-code
```

## 配置

设置 DeepSeek API Key（在 [platform.deepseek.com](https://platform.deepseek.com) 获取）：

```bash
export DEEPSEEK_API_KEY=sk-xxx
```

Windows PowerShell：

```powershell
$env:DEEPSEEK_API_KEY="sk-xxx"
```

## 使用

```bash
# 启动交互式对话
ds-code

# 带初始 prompt 启动
ds-code "帮我看看这个项目的结构"

# 指定模型
ds-code --model reasoner

# 恢复上次会话
ds-code --resume
```

## 功能

- **交互式终端 UI** — 流式输出，实时工具调用状态显示
- **Agent 工具链** — 自动读写文件、搜索代码、执行命令，完成复杂任务
- **权限控制** — 只读操作自动放行，写入和命令执行需确认
- **多模型切换** — deepseek-v4-pro / deepseek-v4-flash / deepseek-reasoner
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
| `/model <name>` | 直接切换（pro / flash / reasoner） |
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
- DeepSeek API Key

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
