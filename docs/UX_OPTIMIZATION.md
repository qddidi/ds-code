# ds-code 用户体验优化方案

## 概览

基于代码审查，识别出 10 项影响用户体验的问题，按优先级排列并附带测试要求。

---

## P0 — 必须立即修复

### 1. 接入流式输出

**现状：** Agent 使用 `client.chat()` 非流式调用，用户发送消息后只能看 spinner 转圈，直到完整响应返回才一次性显示。等待时间 10-30 秒。

**目标：** 文本逐块输出，用户实时看到 AI "打字"。

**改动范围：**
- `src/core/agent.ts` — `run()` 方法改用 `client.chatStream()`，通过 callback 逐块推送内容
- `src/cli/repl.ts` — `onContent` 回调从"最终一次性打印"改为"增量写入 stdout"
- Spinner 在收到第一个 content chunk 时自动停止

**测试清单：**
- [ ] 普通文本回答：内容逐块显示，无乱码、无重复
- [ ] 包含 tool_calls 的回答：工具调用前的文本正常流式，工具执行期间不输出垃圾内容
- [ ] 空回答（模型返回空 content）：不崩溃，不打印空行
- [ ] 网络中断：流中断后给出友好错误提示
- [ ] Markdown 渲染：流式输出完成后，最终文本的 markdown 格式正确（代码块、列表等）
- [ ] reasoner 模型：reasoning_content 正确处理，不与 content 混淆

---

### 2. Ctrl+C 中断支持

**现状：** `repl.ts:67` 定义了 `abortController` 但未使用。用户无法中断正在进行的 API 调用或工具执行。

**目标：** Ctrl+C 立即取消当前操作，回到输入提示符。

**改动范围：**
- `src/core/agent.ts` — `run()` 接受 `AbortSignal` 参数，传入 API 调用和工具执行
- `src/api/deepseek.ts` — `fetchRaw()` 使用外部传入的 signal（与 timeout signal 合并）
- `src/cli/repl.ts` — SIGINT 处理：调用 `abortController.abort()`，停止 spinner，打印提示

**测试清单：**
- [ ] API 调用中按 Ctrl+C：请求取消，打印 "已中断"，回到 `>` 提示符
- [ ] 工具执行中按 Ctrl+C：子进程被 kill，回到提示符
- [ ] 流式输出中按 Ctrl+C：流中断，已输出的内容保留，回到提示符
- [ ] 空闲状态按 Ctrl+C：不退出程序（或按两次退出，与常见 CLI 行为一致）
- [ ] 中断后继续对话：消息历史正确，不包含半截的 assistant 消息

---

## P1 — 核心功能缺失

### 3. 权限确认接入 REPL

**现状：** `PermissionManager` 有 `confirm` 回调机制，但 REPL 未注入。写文件、执行命令等操作无交互确认。

**目标：** 写入/执行类工具调用前，终端弹出确认提示，用户可选 Allow / Always Allow / Deny。

**改动范围：**
- `src/cli/repl.ts` — 创建 `PermissionManager` 实例，注入 `confirm` 回调（readline 交互）
- `src/tools/registry.ts` — `execute()` 调用前检查权限
- 新增 `src/cli/permission-prompt.ts` — 封装终端权限确认 UI

**测试清单：**
- [ ] `write_file` 调用触发确认提示，显示目标路径
- [ ] `bash` 调用触发确认提示，显示要执行的命令
- [ ] `read_file` / `glob` / `grep` 不触发确认（只读工具）
- [ ] 选择 "Allow once"：本次放行，下次同工具仍提示
- [ ] 选择 "Always allow"：后续同工具不再提示
- [ ] 选择 "Deny"：工具返回 denied 错误，模型收到反馈并调整策略
- [ ] 危险命令（`rm -rf /`）：直接拒绝，不弹确认
- [ ] 配置文件 `allowedCommands` 中的命令：自动放行，不弹确认

---

### 4. Initial Prompt 支持

**现状：** `--help` 文档写了 `ds-code "fix the bug"` 可带初始 prompt，但代码未实现。

**目标：** 位置参数作为首条消息直接发送，跳过等待用户输入。

**改动范围：**
- `bin/ds-code.ts` — 解析位置参数，传入 `startRepl({ initialPrompt })`
- `src/cli/repl.ts` — `startRepl` 接受 `initialPrompt`，启动后立即执行

**测试清单：**
- [ ] `ds-code "hello"` — 启动后直接发送 "hello"，不等待输入
- [ ] `ds-code --model flash "hello"` — model 和 prompt 同时生效
- [ ] `ds-code` 无参数 — 正常进入交互模式
- [ ] 带引号的多词 prompt — 正确拼接为一条消息
- [ ] 初始 prompt 执行完毕后 — 回到交互模式，可继续对话

---

### 5. Session 持久化接入

**现状：** `SessionStore` 已实现保存/恢复/列表，但 REPL 未使用。退出后对话丢失。

**目标：** 自动保存对话，支持恢复上次会话。

**改动范围：**
- `src/cli/repl.ts` — 启动时创建 session，每轮对话后 autosave
- `bin/ds-code.ts` — 支持 `--resume` flag
- `/resume` 斜杠命令 — 恢复最近一次会话

**测试清单：**
- [ ] 正常对话后退出 — `~/.ds-code/sessions/` 下生成 session 文件
- [ ] Session 文件内容 — 包含完整消息历史（system、user、assistant、tool）
- [ ] `--resume` 启动 — 加载上次会话，模型能看到历史上下文
- [ ] `/resume` 命令 — 中途恢复，清除当前对话并加载历史
- [ ] 无历史 session 时 `--resume` — 友好提示 "没有可恢复的会话"
- [ ] 多 session 并发 — 各自独立保存，不互相覆盖

---

## P2 — 体验提升

### 6. Context 压缩接入

**现状：** `ContextManager` 已实现 token 估算和压缩，但 Agent 直接管理 messages 数组，未使用。长对话会超出上下文窗口。

**目标：** 对话接近 token 上限时自动压缩历史，保留最近消息 + 摘要。

**改动范围：**
- `src/core/agent.ts` — 用 `ContextManager` 替代裸 `messages` 数组
- 压缩触发时调用模型生成摘要（或使用简单截断策略作为 fallback）

**测试清单：**
- [ ] 短对话（< 阈值）— 不触发压缩，消息完整保留
- [ ] 长对话（> 80% 阈值）— 自动压缩，保留最近 4 条 + 摘要
- [ ] 压缩后继续对话 — 模型仍能理解上下文（摘要有效）
- [ ] Token 估算准确性 — CJK 文本估算误差 < 20%
- [ ] 压缩过程中的 UI 反馈 — 显示 "正在压缩上下文..."

---

### 7. 错误重试与友好提示

**现状：** API 错误直接冒泡，打印原始错误信息。无重试、无退避。

**目标：** 网络错误自动重试，限流错误显示等待时间，认证错误给出明确指引。

**改动范围：**
- `src/api/deepseek.ts` — 添加重试逻辑（指数退避，最多 3 次）
- `src/cli/repl.ts` — 错误分类处理，显示用户友好的中文提示

**测试清单：**
- [ ] 网络超时 — 自动重试最多 3 次，每次间隔递增
- [ ] 429 RateLimitError — 显示 "API 限流，X 秒后重试..."，自动等待后重试
- [ ] 401 AuthenticationError — 显示 "API Key 无效，请检查 DEEPSEEK_API_KEY 环境变量"
- [ ] 500 服务端错误 — 重试 1 次，仍失败则提示 "服务暂时不可用"
- [ ] 重试成功 — 用户无感知，正常显示结果
- [ ] 重试全部失败 — 回到提示符，用户可重新发送

---

## P3 — 锦上添花

### 8. 工具执行结果摘要

**现状：** 工具执行后只显示 `✓ tool_name`，用户不知道具体做了什么。

**目标：** 关键工具显示一行摘要信息。

**改动范围：**
- `src/cli/output.ts` — `renderToolResult` 增加摘要参数

**测试清单：**
- [ ] `write_file` 成功 — 显示 "✓ write_file — 写入 42 行到 src/foo.ts"
- [ ] `bash` 成功 — 显示 "✓ bash — exit 0"（命令已在调用时显示）
- [ ] `edit_file` 成功 — 显示 "✓ edit_file — 替换了 3 处"
- [ ] `read_file` — 保持简洁，只显示 "✓ read_file"（内容不需要摘要）
- [ ] 工具失败 — 显示 "✗ tool_name — 错误原因摘要"

---

### 9. 多行输入支持

**现状：** readline 单行输入，粘贴多行代码体验差。

**目标：** 支持多行输入模式（如 `"""` 开头进入，`"""` 结尾提交）。

**改动范围：**
- `src/cli/input.ts` — 识别多行模式标记
- `src/cli/repl.ts` — 多行模式下累积输入，直到结束标记

**测试清单：**
- [ ] 输入 `"""` 进入多行模式 — 提示符变为 `...`
- [ ] 多行模式中输入多行文本 — 正确累积
- [ ] 输入 `"""` 结束 — 整体作为一条消息发送
- [ ] 多行模式中 Ctrl+C — 取消当前输入，回到单行模式
- [ ] 粘贴包含 `"""` 的代码 — 不误触发（需要独占一行）
- [ ] 空多行输入（直接 `"""` 开 `"""` 关）— 忽略，不发送

---

### 10. /help 命令增强

**现状：** `/help` 只打印命令列表，无使用示例和配置说明。

**目标：** 提供分类帮助信息，包含快捷键、配置方法、常见用法。

**改动范围：**
- `src/cli/repl.ts` — `handleCommand('/help')` 输出增强内容

**测试清单：**
- [ ] `/help` — 显示完整帮助（命令列表 + 快捷键 + 配置路径）
- [ ] `/help` 输出宽度 — 不超过 80 列，终端兼容
- [ ] 帮助内容与实际功能一致 — 不列出未实现的命令

---

## 测试策略

### 单元测试

| 模块 | 测试重点 |
|------|----------|
| `agent.ts` | 流式回调触发顺序、abort 中断、max iterations |
| `deepseek.ts` | 重试逻辑、超时处理、错误分类 |
| `permission-manager.ts` | 各决策路径、always allow 记忆 |
| `context.ts` | 压缩触发条件、消息保留策略 |
| `session.ts` | 保存/加载/列表/恢复 |
| `input.ts` | 多行模式解析 |

### 集成测试

| 场景 | 验证点 |
|------|--------|
| 完整对话流程 | 输入 → 流式输出 → 工具调用 → 权限确认 → 结果显示 |
| 中断恢复 | Ctrl+C 后消息历史一致性 |
| Session 持久化 | 退出 → 重启 → resume → 上下文连续 |
| 长对话 | 自动压缩 → 继续对话 → 模型理解上下文 |
| 错误恢复 | 模拟网络断开 → 重试 → 成功/最终失败 |

### 手动验收测试

| 场景 | 预期体验 |
|------|----------|
| 首次启动 | < 1 秒看到欢迎信息和提示符 |
| 发送消息 | < 2 秒看到第一个字符输出（流式） |
| 工具调用 | 看到工具名 + 参数摘要 → spinner → 结果摘要 |
| 权限确认 | 清晰显示要做什么，Y/N/A 选项明确 |
| Ctrl+C | 立即响应，无残留输出 |
| 长对话（20+ 轮）| 无明显变慢，无 token 超限报错 |
| 退出再进入 | `--resume` 恢复上下文，对话连续 |
