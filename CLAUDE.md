# CLAUDE.md — ds-code 项目指引

## 项目简介

ds-code 是一个基于 Node.js + TypeScript 的交互式 AI 编程助手 CLI，使用 DeepSeek API，功能对标 Claude Code。

## 关键文档

- `TECHNICAL_PLAN.md` — 技术方案（架构、选型、配置设计）
- `MODULES_AND_TESTS.md` — 模块拆分与测试计划

## 开发命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式（ts-node）
pnpm build          # 构建（tsup）
pnpm test           # 运行测试（vitest）
pnpm lint           # 代码检查
```

## 代码规范

- 使用 ESM（"type": "module"）
- 文件命名：kebab-case（如 `token-count.ts`）
- 导出风格：named export，不用 default export
- 错误处理：工具层返回 ToolResult（不抛异常），核心层用 typed error class
- 不写注释，除非解释 why
- 不用 any，必要时用 unknown + 类型守卫

## 项目专属 Skills

| 命令 | 用途 |
|------|------|
| `/implement-module M0x` | 实现指定模块 |
| `/write-tests M0x` | 为模块编写测试 |
| `/add-tool <名称>` | 添加新工具 |
| `/debug` | 诊断修复 bug |
| `/review` | 代码审查 |
| `/status` | 查看项目进度 |
| `/add-dep <包名>` | 添加依赖 |
| `/optimize-prompt` | 优化 prompt |
| `/release <版本>` | 发布版本 |
| `/refactor` | 重构代码 |

## 架构要点

- Agent 循环：用户输入 → API 调用 → 响应/工具调用 → 循环直到纯文本
- 工具系统：统一 Tool 接口，通过 registry 注册，自动生成 function calling schema
- 权限三级：自动允许（只读）→ 需确认（写入/执行）→ 拒绝（黑名单）
- API 格式：兼容 OpenAI chat completions 格式（DeepSeek 原生兼容）
