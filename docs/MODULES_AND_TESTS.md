# ds-code 模块拆分与测试计划

## 模块总览

| 编号 | 模块 | 路径 | 优先级 | 依赖 |
|------|------|------|--------|------|
| M01 | 项目基础设施 | / | P0 | 无 |
| M02 | API 客户端 | src/api/ | P0 | M01 |
| M03 | 消息与类型 | src/core/message.ts | P0 | M01 |
| M04 | 工具系统框架 | src/tools/ | P0 | M03 |
| M05 | Agent 核心循环 | src/core/agent.ts | P0 | M02, M03, M04 |
| M06 | CLI 交互层 | src/cli/ | P0 | M05 |
| M07 | 文件操作工具 | src/tools/read,write,edit | P1 | M04 |
| M08 | 搜索工具 | src/tools/glob,grep,list-dir | P1 | M04 |
| M09 | Bash 工具 | src/tools/bash.ts | P1 | M04, M10 |
| M10 | 权限系统 | src/permissions/ | P1 | M01 |
| M11 | 配置管理 | src/config/ | P1 | M01 |
| M12 | 上下文管理 | src/core/context.ts | P2 | M02, M03 |
| M13 | 会话管理 | src/core/session.ts | P2 | M03 |
| M14 | Git 集成 | src/utils/git.ts | P2 | M09 |
| M15 | 多模型支持 | src/api/, src/cli/model.ts | P3 | M02, M11 |
| M16 | 错误重试 | src/api/retry.ts | P1 | M02 |
| M17 | Token 计数 | src/utils/token-count.ts | P2 | M01 |

---

## M01 — 项目基础设施

### 范围

- package.json（name、scripts、dependencies）
- tsconfig.json
- tsup.config.ts（构建配置）
- vitest.config.ts（测试配置）
- bin/ds-code.ts（CLI 入口 shebang）
- ESLint 配置
- .gitignore

### 完成标准

- `pnpm install` 无报错
- `pnpm build` 产出 dist/index.js
- `pnpm test` 能运行（即使无测试用例）
- `node dist/index.js --version` 输出版本号

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 构建产物可执行 | 集成 | `node dist/index.js --help` 返回帮助信息，退出码 0 |
| TypeScript 编译 | 构建 | `tsc --noEmit` 无错误 |
| ESM 导入正常 | 单元 | 动态 import dist 产物不报错 |

---

## M02 — API 客户端

### 范围

- `src/api/types.ts` — 请求/响应类型定义
- `src/api/deepseek.ts` — DeepSeek API 封装（chat completions）
- `src/api/stream.ts` — SSE 流式解析器
- `src/api/retry.ts` — 错误重试（指数退避）
- `src/api/index.ts` — 模块导出

### 完成标准

- 能发送非流式请求并解析响应
- 能发送流式请求，逐 chunk 回调
- 支持 function calling 参数传递
- 网络错误/API 错误有明确异常类型

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 非流式请求 | 单元（mock） | 构造正确的请求体，解析标准响应为 Message 对象 |
| 流式请求解析 | 单元 | 输入模拟 SSE 数据，验证 onChunk 回调顺序和内容 |
| tool_calls 解析 | 单元 | 响应含 tool_calls 时正确提取函数名和参数 |
| 错误处理 — 401 | 单元 | 返回 AuthenticationError |
| 错误处理 — 429 | 单元 | 返回 RateLimitError，包含 retry-after |
| 错误处理 — 网络超时 | 单元 | 返回 NetworkError |
| 请求头正确 | 单元 | Authorization、Content-Type 正确设置 |
| 流式中断恢复 | 单元 | 连接中断时触发 error 事件而非静默丢失 |

---

## M03 — 消息与类型

### 范围

- `src/core/message.ts` — 消息类型（system/user/assistant/tool）
- 消息构建辅助函数
- Token 计数估算 `src/utils/token-count.ts`

### 完成标准

- 定义完整的消息类型体系
- 能构建符合 OpenAI 格式的消息数组
- Token 估算误差 < 10%

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 消息序列化 | 单元 | 各类型消息转为 API 格式后字段完整 |
| tool 消息关联 | 单元 | tool 结果消息正确关联 tool_call_id |
| token 计数 — 英文 | 单元 | "hello world" 估算约 2-3 tokens |
| token 计数 — 中文 | 单元 | "你好世界" 估算约 4-6 tokens |
| token 计数 — 代码 | 单元 | 一段 50 行代码估算在合理范围 |

---

## M04 — 工具系统框架

### 范围

- `src/tools/types.ts` — Tool 接口、ToolResult 类型
- `src/tools/registry.ts` — 工具注册、查找、schema 导出

### 完成标准

- 工具可通过装饰器或函数注册
- registry 能导出符合 OpenAI tools 格式的 JSON Schema
- 能根据名称查找并执行工具
- 参数校验失败时返回明确错误

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 注册工具 | 单元 | 注册后 registry.get(name) 返回工具实例 |
| 重复注册 | 单元 | 同名工具注册抛出错误 |
| 导出 schema | 单元 | 导出格式符合 OpenAI function calling tools 规范 |
| 参数校验 — 缺少必填 | 单元 | 执行时返回 validation error |
| 参数校验 — 类型错误 | 单元 | string 字段传 number 返回错误 |
| 执行成功 | 单元 | mock 工具返回预期 ToolResult |
| 未知工具 | 单元 | registry.get("不存在") 返回 undefined |

---

## M05 — Agent 核心循环

### 范围

- `src/core/agent.ts` — 主循环逻辑
  - 接收用户输入 → 构建消息 → 调用 API → 处理响应
  - 工具调用循环（调用工具 → 结果回传 → 再次请求）
  - 最大循环次数限制（防止无限循环）

### 完成标准

- 纯文本响应直接返回
- 工具调用能正确执行并将结果回传
- 多轮工具调用（连续调用多个工具）正常工作
- 超过最大循环次数时中断并提示

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 纯文本响应 | 单元（mock API） | 用户输入 → API 返回文本 → agent 输出该文本 |
| 单次工具调用 | 单元 | API 返回 tool_call → 执行工具 → 结果回传 → 最终文本 |
| 连续工具调用 | 单元 | API 连续返回 2 次 tool_call，均正确执行 |
| 并行工具调用 | 单元 | 一次响应含多个 tool_calls，全部执行后一起回传 |
| 循环上限 | 单元 | 超过 maxIterations 时中断，返回错误提示 |
| 工具执行失败 | 单元 | 工具抛异常时，将错误信息作为 tool result 回传 |
| 消息历史累积 | 单元 | 多轮对话后消息数组包含完整历史 |

---

## M06 — CLI 交互层

### 范围

- `src/cli/repl.ts` — REPL 主循环
- `src/cli/input.ts` — 多行输入解析
- `src/cli/output.ts` — Markdown 渲染、工具结果摘要
- `src/cli/spinner.ts` — 等待动画
- `src/cli/commands.ts` — 斜杠命令定义与匹配
- `src/cli/slash-autocomplete.ts` — 斜杠命令 inline 补全（输入行下方实时提示）
- `src/cli/model.ts` — /model 命令处理（模型切换）
- `src/cli/permission-prompt.ts` — 权限确认交互（Y/A/N）
- `src/cli/index.ts` — 模块导出

### 完成标准

- 启动后显示欢迎信息和提示符
- 支持多行输入（`"""` 进入/退出多行模式）
- AI 响应实时流式输出
- Markdown 格式正确渲染（标题、列表、代码块）
- 等待 API 时显示 spinner（thinking 时更新文字）
- Ctrl+C 中断当前请求，Ctrl+D 退出
- 斜杠命令输入时下方实时显示补全提示（↑↓选择、Tab补全、Enter执行）
- 支持 `--resume` 恢复上次会话
- 支持位置参数作为 initial prompt

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| Markdown 渲染 — 代码块 | 单元 | 输入含 ```js 的文本，输出带语法高亮 |
| Markdown 渲染 — 标题 | 单元 | # 标题 渲染为粗体/带颜色 |
| Markdown 渲染 — 列表 | 单元 | 有序/无序列表正确缩进 |
| 输入处理 — 空输入 | 单元 | 空行不触发 API 调用 |
| 输入处理 — 斜杠命令 | 单元 | /help 等命令不发送给 API |
| 输入处理 — 多行模式 | 单元 | `"""` 进入多行，再次 `"""` 结束并拼接 |
| 斜杠命令匹配 | 单元 | `/he` 匹配 /help，`/m` 匹配 /model /memory |
| 斜杠命令选择 | 单元 | clampSelection 正确循环索引 |
| Spinner 启停 | 单元 | start() 后 isSpinning=true，stop() 后恢复 |
| 流式输出 | 集成 | mock 流式响应，验证字符逐个输出 |
| Ctrl+C 中断 | 集成 | 发送 SIGINT 后当前请求取消，回到提示符 |

---

## M07 — 文件操作工具

### 范围

- `src/tools/read.ts` — 读取文件（支持行范围）
- `src/tools/write.ts` — 创建/覆写文件
- `src/tools/edit.ts` — 精确字符串替换

### 完成标准

- Read：读取文件内容，支持 offset/limit，带行号输出
- Write：创建文件（含目录创建）、覆写已有文件
- Edit：精确匹配 old_string 并替换为 new_string

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| Read — 完整文件 | 单元 | 读取测试文件，返回全部内容带行号 |
| Read — 行范围 | 单元 | offset=5, limit=10 只返回第 5-14 行 |
| Read — 文件不存在 | 单元 | 返回明确错误信息 |
| Read — 二进制文件 | 单元 | 检测并拒绝，返回提示 |
| Write — 新文件 | 单元（临时目录） | 文件创建成功，内容正确 |
| Write — 自动建目录 | 单元 | 父目录不存在时自动创建 |
| Write — 覆写 | 单元 | 已有文件被新内容覆盖 |
| Edit — 单次替换 | 单元 | old_string 被替换为 new_string |
| Edit — 多次替换 | 单元 | replace_all=true 时所有匹配都被替换 |
| Edit — 匹配不到 | 单元 | old_string 不存在时返回错误 |
| Edit — 多处匹配但未指定 replace_all | 单元 | 返回错误，要求精确匹配 |
| Edit — 保持缩进 | 单元 | 替换后文件缩进不被破坏 |

---

## M08 — 搜索工具

### 范围

- `src/tools/glob.ts` — 文件名模式匹配
- `src/tools/grep.ts` — 文件内容正则搜索
- `src/tools/list-dir.ts` — 目录列表

### 完成标准

- Glob：支持 `**/*.ts` 等模式，返回匹配文件列表
- Grep：支持正则、忽略大小写、上下文行数
- ListDir：列出目录内容，区分文件/目录

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| Glob — 递归匹配 | 单元（临时目录） | `**/*.ts` 找到嵌套目录中的 .ts 文件 |
| Glob — 无匹配 | 单元 | 返回空数组，无报错 |
| Glob — 排除 node_modules | 单元 | 默认忽略 node_modules |
| Grep — 基础搜索 | 单元 | 搜索 "TODO" 返回匹配行和文件 |
| Grep — 正则 | 单元 | `function\s+\w+` 匹配函数声明 |
| Grep — 忽略大小写 | 单元 | -i 标志生效 |
| Grep — 上下文行 | 单元 | -C 2 返回匹配行前后各 2 行 |
| Grep — 无结果 | 单元 | 返回空，无报错 |
| ListDir — 正常目录 | 单元 | 返回文件和子目录列表 |
| ListDir — 空目录 | 单元 | 返回空数组 |
| ListDir — 不存在 | 单元 | 返回错误信息 |

---

## M09 — Bash 工具

### 范围

- `src/tools/bash.ts` — 执行 shell 命令
  - 支持超时
  - 捕获 stdout/stderr
  - 返回退出码

### 完成标准

- 执行命令并返回 stdout + stderr + exitCode
- 超时自动终止子进程
- 危险命令需经过权限系统确认
- 工作目录为用户当前项目目录

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 执行简单命令 | 单元 | `echo hello` 返回 stdout="hello\n", exitCode=0 |
| 捕获 stderr | 单元 | 命令输出到 stderr 时正确捕获 |
| 非零退出码 | 单元 | `exit 1` 返回 exitCode=1 |
| 超时终止 | 单元 | 设置 timeout=1s，执行 `sleep 10`，验证被终止 |
| 工作目录 | 单元 | 执行 `pwd` 返回预期目录 |
| 权限检查 | 集成 | 执行 `rm -rf /` 时触发权限拒绝 |
| 命令注入防护 | 单元 | 参数中的特殊字符不会被 shell 解释执行 |

---

## M10 — 权限系统

### 范围

- `src/permissions/rules.ts` — 权限规则定义（允许/确认/拒绝）
- `src/permissions/manager.ts` — 权限判断、用户交互确认

### 完成标准

- 只读工具自动放行
- 写操作和命令执行需用户确认
- 用户可选择"本次允许"或"始终允许"
- 配置文件中的白名单命令自动放行
- 黑名单命令直接拒绝

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 只读工具 — 自动允许 | 单元 | Read/Glob/Grep 不触发确认 |
| 写工具 — 需确认 | 单元 | Write/Edit 触发确认流程 |
| Bash — 白名单命令 | 单元 | `npm test` 在白名单中时自动允许 |
| Bash — 普通命令 | 单元 | 非白名单命令触发确认 |
| Bash — 黑名单命令 | 单元 | `rm -rf /` 直接拒绝，不询问 |
| 始终允许 | 单元 | 用户选择"始终允许"后同类操作不再询问 |
| 规则优先级 | 单元 | 黑名单 > 白名单 > 默认规则 |

---

## M11 — 配置管理

### 范围

- `src/config/schema.ts` — 配置 schema 定义与校验
- `src/config/defaults.ts` — 默认配置值
- `src/config/loader.ts` — 加载全局配置 + 项目配置并合并

### 完成标准

- 加载 `~/.ds-code/config.json`（全局）
- 加载 `.ds-code/settings.json`（项目级）
- 项目配置覆盖全局配置
- 配置校验失败时给出明确提示
- 首次运行无配置文件时使用默认值

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 加载默认配置 | 单元 | 无配置文件时返回默认值 |
| 加载全局配置 | 单元（临时文件） | 正确读取并解析 JSON |
| 加载项目配置 | 单元 | 项目配置字段覆盖全局 |
| 合并策略 | 单元 | 深度合并，数组替换而非追加 |
| 无效 JSON | 单元 | 解析失败时抛出友好错误 |
| schema 校验 — 无效字段 | 单元 | 未知字段被忽略或警告 |
| schema 校验 — 类型错误 | 单元 | temperature="abc" 报错 |
| API Key 缺失 | 单元 | 明确提示用户配置 API Key |

---

## M12 — 上下文管理

### 范围

- `src/core/context.ts`
  - Token 计数跟踪
  - 自动压缩触发
  - 压缩策略（摘要替换早期消息）

### 完成标准

- 实时跟踪当前上下文 token 数
- 接近限制（如 80%）时自动触发压缩
- 压缩后消息数减少但关键信息保留
- 压缩过程对用户透明（可选提示）

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| Token 计数累积 | 单元 | 每次添加消息后 totalTokens 增加 |
| 触发阈值 | 单元 | 超过 80% 限制时 shouldCompress()=true |
| 压缩执行 | 单元（mock API） | 压缩后消息数减少，首条为摘要 |
| 系统消息保留 | 单元 | 压缩不会删除 system 消息 |
| 最近消息保留 | 单元 | 最近 N 条消息不被压缩 |
| 未达阈值不压缩 | 单元 | 50% 使用率时不触发 |

---

## M13 — 会话管理

### 范围

- `src/core/session.ts`
  - 会话保存（消息历史持久化到文件）
  - 会话恢复（从文件加载历史）
  - 会话列表

### 完成标准

- 对话自动保存到 `~/.ds-code/sessions/`
- 支持 `--resume` 恢复上次会话
- 支持列出历史会话
- 会话文件格式为 JSON

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 保存会话 | 单元（临时目录） | 消息历史写入 JSON 文件 |
| 恢复会话 | 单元 | 从文件加载后消息数组完整 |
| 会话列表 | 单元 | 返回按时间排序的会话摘要 |
| 自动保存 | 单元 | 每次对话后文件更新 |
| 损坏文件 | 单元 | JSON 损坏时跳过并提示，不崩溃 |
| 会话 ID 唯一 | 单元 | 多次创建不会 ID 冲突 |

---

## M14 — Git 集成

### 范围

- `src/utils/git.ts`
  - 检测是否在 git 仓库中
  - 获取当前分支、状态
  - diff 查看
  - 辅助 commit（生成 commit message）

### 完成标准

- 检测 .git 目录判断是否为 git 仓库
- 获取 branch、status、diff 信息
- 可作为上下文提供给 Agent

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 检测 git 仓库 | 单元（临时 git repo） | 在 git 目录返回 true |
| 非 git 目录 | 单元 | 返回 false，不报错 |
| 获取分支名 | 单元 | 返回当前分支名称 |
| 获取 status | 单元 | 有修改文件时返回文件列表 |
| 获取 diff | 单元 | 返回 unified diff 格式 |
| git 未安装 | 单元 | 优雅降级，返回错误提示 |

---

## M15 — 多模型支持

### 范围

- `src/api/deepseek.ts` 支持 DeepSeek/OpenAI/custom provider 与模型切换
- `src/cli/model.ts` — /model 命令处理
- DeepSeek 支持模型：deepseek-v4-pro（默认）、deepseek-v4-flash、deepseek-reasoner
- OpenAI/custom provider 支持任意非空模型名，便于使用 GPT 和 OpenAI-compatible 中转站
- 运行时切换命令 `/model`
- `supportsTools()` 函数判断模型是否支持 function calling

### 完成标准

- 默认使用 deepseek-v4-pro
- 用户可通过配置、CLI 参数或 `/model` 命令切换模型
- OpenAI/custom provider 可使用 gpt-* 或中转站模型别名
- reasoner 模式下正确处理 reasoning_content 字段（单独存储并回传）
- 不支持 function calling 的模型（reasoner）不传 tools 参数

### 测试

| 测试项 | 类型 | 验证内容 |
|--------|------|---------|
| 默认模型 | 单元 | 未配置时使用 deepseek-v4-pro |
| 切换模型 | 单元 | /model reasoner 后请求使用 deepseek-reasoner |
| reasoner 响应解析 | 单元 | 正确提取 reasoning_content 和 content |
| reasoner 无 tools | 单元 | 切换到 reasoner 时不传 tools 参数 |
| OpenAI/custom 模型 | 单元 | provider=openai/custom 时允许 gpt-* 或中转站模型别名 |
| 无效模型名 | 单元 | DeepSeek 返回可用模型列表，OpenAI/custom 拒绝空模型名 |
| supportsTools | 单元 | v4-pro/v4-flash 返回 true，reasoner 返回 false |

---

## 集成测试计划

除各模块单元测试外，需要以下端到端集成测试：

| 场景 | 验证内容 |
|------|---------|
| 完整对话流程 | 启动 → 输入问题 → 收到回答 → 退出 |
| 文件编辑流程 | 要求创建文件 → Agent 调用 Write → 文件实际创建 |
| 多工具协作 | 要求修改文件 → Agent 先 Read 再 Edit → 文件正确修改 |
| 权限拦截 | 要求执行危险命令 → 权限系统拦截 → 用户拒绝 → 命令未执行 |
| 上下文压缩 | 发送大量消息直到触发压缩 → 压缩后对话仍连贯 |
| 配置生效 | 修改配置文件 → 重启后新配置生效 |
| 错误恢复 | API 返回 500 → 重试 → 最终成功或友好报错 |

---

## 测试基础设施

```
test/
├── fixtures/              # 测试用的固定文件
│   └── sample-project/    # 模拟项目目录
├── helpers/
│   ├── mock-api.ts        # DeepSeek API mock server
│   ├── temp-dir.ts        # 临时目录创建/清理
│   ├── test-tools.ts      # 工具测试辅助
│   └── test-infrastructure.test.ts  # 测试基础设施自检
├── api/
│   ├── deepseek.test.ts   # API 客户端测试
│   ├── stream.test.ts     # SSE 流解析测试
│   └── model.test.ts      # 多模型支持测试
├── cli/
│   ├── commands.test.ts   # 斜杠命令匹配测试
│   ├── input.test.ts      # 输入解析测试
│   ├── output.test.ts     # 输出渲染测试
│   └── spinner.test.ts    # Spinner 测试
├── core/
│   ├── agent.test.ts      # Agent 循环测试
│   ├── context.test.ts    # 上下文管理测试
│   ├── message.test.ts    # 消息构造测试
│   └── session.test.ts    # 会话持久化测试
├── tools/
│   ├── registry.test.ts   # 工具注册测试
│   ├── read.test.ts       # 文件读取测试
│   ├── write.test.ts      # 文件写入测试
│   ├── edit.test.ts       # 文件编辑测试
│   ├── glob.test.ts       # 文件搜索测试
│   ├── grep.test.ts       # 内容搜索测试
│   ├── bash.test.ts       # 命令执行测试
│   └── list-dir.test.ts   # 目录列表测试
├── permissions/
│   └── manager.test.ts    # 权限管理测试
├── config/
│   └── loader.test.ts     # 配置加载测试
├── utils/
│   ├── git.test.ts        # Git 工具测试
│   └── token-count.test.ts # Token 计数测试
├── integration/
│   └── real-deepseek-flow.test.ts  # 真实 API 集成测试
└── index.test.ts          # 主入口测试
```

### 测试约定

- 单元测试：mock 所有外部依赖或者使用实际key（API、文件系统）
- 集成测试：使用临时目录，mock API 但真实文件操作
- 所有测试使用 vitest
- 覆盖率目标：核心模块 > 80%，工具模块 > 90%
- CI 中运行：`pnpm test --coverage`
