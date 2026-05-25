# ds-code 优化分析报告

> 基于对项目源码、文档及已知问题的审查，沉淀 ds-code 当前优化项、风险、优先级与可执行落地计划。
>
> 状态图例：`已完成` / `已优化` / `已初步优化` / `待处理` / `暂缓` / `继续观察`。

---

## 一、已知问题与处理状态（来自 `docs/q.md`）

### 1.1 Skills 用完未清理（已优化）

- **原现状**：Skills 激活后的临时权限（`allowed-tools`）在 run 结束后未回收，或回收逻辑不完整。
- **影响**：后续对话中工具权限可能被错误放大。
- **已完成**：`PermissionManager.withTemporaryAllowlist()` 已改为栈式临时 allowlist；通过 `finally` 在正常完成、异常抛出、嵌套 skill 场景下恢复作用域，避免权限泄漏。
- **验证**：已补充/通过 `test/permissions/manager.test.ts` 中临时权限作用域、嵌套作用域异常恢复等测试。

### 1.2 上下文过长时增加索引并存入本地（暂缓）

- **现状**：当前上下文压缩只做摘要，没有将完整历史存入本地文件再索引。
- **影响**：超长对话后，早期细节不可恢复；压缩摘要遗漏时难以追溯。
- **建议方案**：
  1. 在 `ContextManager.compress()` 前将被压缩的原始消息 dump 到 `.ds-code/sessions/{sessionId}/archives/{timestamp}.json`。
  2. 为 archive 生成轻量 manifest：时间、消息数、估算 token、首尾摘要。
  3. 在 system prompt 或 `/context` 命令中提示可检索 archive。
  4. 后续可增加关键词检索或 embedding 索引。
- **优先级**：P3。建议先完成日志、初始化错误、安全边界后再推进。

### 1.3 输出内容非常多时屏幕持续抖动（已优化，继续观察）

- **原现状**：`app.tsx` 使用 `setInterval(fn, 16)` 每 16ms 全量 setState 刷新 `streamingText`，流式内容长时 React/Ink 频繁重渲染导致抖动。
- **影响**：长内容流式输出用户体验差。
- **已完成**：
  - 流式刷新间隔已从 16ms 调整为约 50ms。
  - 增加 `lastFlushedStreamingTextRef`，仅当缓冲内容变化时才调用 `setStreamingText()`。
- **后续可选**：若极长 Markdown 仍卡顿，继续做分段渲染、历史消息裁剪或虚拟化。

### 1.4 创建临时脚本应放到 `.ds-code` 目录下（已优化）

- **原现状**：Agent 在执行任务时可能把临时脚本创建在工作区根目录。
- **影响**：污染用户项目。
- **已完成**：默认 system prompt 已明确要求临时脚本写入 `.ds-code/scripts/`。
- **后续可选**：若仍出现根目录临时脚本，可在 `write_file` / `edit_file` 工具层增加路径提示或软约束。

### 1.5 写脚本前未检查语言环境（node 除外）（已优化）

- **原现状**：Agent 可能直接写 Python/Ruby/Shell 脚本并尝试运行，但用户机器可能没有对应运行时。
- **影响**：脚本执行失败。
- **已完成**：默认 system prompt 已加入约束：执行非 Node 脚本前，先用 `bash` 工具检查对应运行时是否存在。

### 1.6 Markdown 渲染重复问题（已初步优化，继续观察）

- **现状**：当 AI 生成很长的 Markdown 内容时，终端曾出现内容重复渲染（同一段文字出现多次）。
- **影响**：输出混乱，不可读。
- **已排查/优化**：
  - 检查了 `MessageList` 的 Ink `Static` 使用方式和消息 `id`，当前消息 key 稳定，未发现明显状态污染。
  - 检查了 `renderMarkdown()` 的 `marked` + `marked-terminal` 管线，未发现直接重复追加逻辑。
  - 已在流式缓冲 flush 中增加内容变化判断，降低重复 setState 和重复渲染风险。
- **后续建议**：
  - 增加 Ink 组件/流式输出回归测试，覆盖“长 Markdown + 完成态提交 + streaming 清空”竞态。
  - 继续检查完成态消息提交与 `streamingText` 清空之间是否存在双渲染窗口。

### 1.7 "Always write" 不生效（已修复）

- **原现状**：用户在权限确认时选择 "Always" 后，同类型写入操作仍然二次确认。
- **影响**：用户预期行为与实际不符。
- **已完成**：
  - `PermissionManager` 对非 bash 工具的 `allow_always` 会写入内存 `alwaysAllowedTools`。
  - 新增配置字段 `permissions.allowedTools`，用于加载已持久化的 always-allowed 工具。
  - 新增 `rememberAllowedTool()`，将非 bash 工具的 Always 决策写入项目 `.ds-code/settings.json`。
  - CLI option / App props / `bin/ds-code.tsx` 已贯通 `allowedTools`，启动后会传入 `PermissionManager`。
- **验证**：已补充/通过权限管理、配置持久化、CLI option 相关测试。

### 1.8 修改内容无新旧对比（已优化）

- **原现状**：`edit_file` 执行后只返回 `Replaced N occurrence(s)`，不展示改动 diff。
- **影响**：用户无法直观看到改了什么。
- **已完成**：`edit_file` 成功替换后会在工具返回内容中追加简易 unified diff，展示变更前后的关键行。
- **验证**：已补充/通过 `test/tools/edit.test.ts` 中 diff 输出断言。
- **后续可选**：如需更精确 diff，可替换为 Myers diff 等成熟行级 diff 算法。

### 1.9 Markdown 输出过程中未渲染（已初步优化，继续观察）

- **原现状**：流式输出时文字以纯文本展示，直到完成后才触发 Markdown 渲染。
- **影响**：阅读体验差，代码块无高亮；长 Markdown 输出时用户难以及时定位结构。
- **已完成**：
  1. 新增 `renderStreamingMarkdown()`，对已闭合代码块和空行分隔的完整片段进行增量渲染。
  2. 未闭合片段保持纯文本，避免半截 Markdown 语法在流式过程中被错误渲染。
  3. `StreamingText` 已改用流式 Markdown 渲染后再展示尾部窗口。
- **验证**：已补充/通过 `test/cli/streaming-text.test.ts`，覆盖标题段落、未闭合代码块、已闭合代码块后接未完成片段。
- **后续可选**：抽出 `streaming-markdown.ts` 并补充表格、嵌套列表等更复杂 Markdown 场景；增加最大渲染字符阈值，超过阈值时退化为纯文本或尾部窗口，避免性能回退。

---

## 二、架构与代码质量

### 2.1 `app.tsx` 过大（待处理）

- **现状**：`src/cli/app.tsx` 约 850 行，混合初始化、状态管理、输入处理、命令路由、Agent 调度、Skills 匹配、UI 渲染等逻辑。
- **风险**：难以测试、维护和调试，UI 状态竞争问题也更难定位。
- **建议拆分顺序**：
  1. `createAgentDeps()`：组装 client / registry / permissionManager / sessionStore / skillRegistry。
  2. `useAgentRuntime()`：封装 Agent 初始化、run、abort、session 保存。
  3. `usePermissionPromptState()`、`useSkillPromptState()`：抽离确认弹窗状态机。
  4. `useSlashCommandRouter()`：抽离 `/help`、`/model`、`/compact` 等命令处理。
  5. `AppView`：只接收 props 并渲染，无副作用。
- **验收标准**：拆分后 `app.tsx` 控制在 300 行左右；核心逻辑可通过 hook/纯函数单测覆盖。

### 2.2 缺少依赖注入/组装层（待处理）

- **现状**：所有依赖在 `useEffect` 中直接 `new` 创建，强耦合。
- **建议**：引入轻量工厂函数 `createAgentDeps(options)`，返回初始化好的 `client`、`registry`、`permissionManager`、`sessionStore`、`skillRegistry`。
- **收益**：降低 UI 与核心逻辑耦合，便于 mock API、mock registry、mock permission。

### 2.3 残留文件 `dev.js`（已优化）

- **原现状**：根目录 `dev.js` 引用 `./src/cli/repl.js`，但该文件不存在，疑似旧版 REPL 模式残留。
- **风险**：误导贡献者；运行后报错。
- **已完成**：`dev.js` 已改为 ESM 入口，转发到新版 `bin/ds-code.tsx`，不再引用不存在的旧 REPL 文件。
- **验证**：已通过 `pnpm test` 与 `pnpm build`。

### 2.4 `isBinary` 函数重复（已优化）

- **原现状**：`src/tools/read.ts` 和 `src/tools/grep.ts` 中有相似的 binary 判断逻辑。
- **已完成**：已提取到 `src/utils/binary.ts`，由 read/grep 共享 `isBinaryBuffer()`。
- **验证**：已补充/通过 `test/utils/binary.test.ts`，并复用 read/grep 既有二进制文件测试。

### 2.5 `isReadOnlyTool` 硬编码（已优化）

- **原现状**：`src/core/agent.ts` 中 `isReadOnlyTool` 用硬编码名称判断只读工具，而非使用 Tool 接口的 `requiresPermission` 属性。
- **风险**：新增只读工具时容易遗漏，影响并行执行策略。
- **已完成**：`ToolRegistry` 新增 `isReadOnly(name)`，通过 `registry.get(name)?.requiresPermission === false` 判断；`Agent` 并行工具执行策略改为读取 registry/Tool 元数据。
- **验证**：已补充/通过 registry 元数据判断测试，以及自定义只读工具并行执行测试。

### 2.6 `serializeMessages` 可能无实际调用（已优化）

- **原现状**：`src/core/message.ts` 中的 `serializeMessages` 逻辑与构造函数几乎一致，生产代码中无调用，仅测试覆盖该函数本身。
- **已完成**：移除 `serializeMessages()` 与对应冗余单测，减少未使用 API 与维护成本。
- **验证**：已通过 `pnpm test` 与 `pnpm build`。

### 2.7 Token 估算为纯启发式算法（已初步优化）

- **原现状**：`src/utils/token-count.ts` 使用字符类型粗略估算，对中英文混合、代码块、特殊符号的估算误差大。
- **影响**：上下文压缩触发时机不准确。
- **已完成**：在保持现有启发式算法不变的基础上，对 `estimateTokens()` 与 `estimateMessagesTokens()` 增加 20% 保守余量，降低超限风险。
- **验证**：已补充/通过 `test/utils/token-count.test.ts` 保守余量断言。
- **后续可选**：P2 接入 `gpt-tokenizer` / `tiktoken` 做精确计数（需评估包体积与模型兼容）。

### 2.8 `SessionStore.list()` 静默跳过损坏文件（待处理）

- **现状**：`src/core/session.ts` 中 `catch { continue }` 静默跳过损坏 JSON。
- **建议**：记录 warnings，供 `/doctor`、日志或调试输出展示。

### 2.9 初始化错误被静默吞噬（P0，已修复）

- **原现状**：`app.tsx` 中 `init().catch(() => {})`，任何启动初始化错误都不可见。
- **风险**：用户看到空白界面但不清楚发生了什么。
- **已完成**：
  - 增加 `initError` 状态；catch 中保存格式化后的错误消息。
  - 未 ready 且存在初始化错误时，UI 渲染启动失败提示，并建议检查 API key、配置文件、skills frontmatter，或修复后运行 `/doctor`。
  - 新增 `formatInitError()`，统一格式化 `unknown` 错误。
- **验证**：已补充/通过 `test/cli/app.test.ts`。

---

## 三、性能优化

### 3.1 流式渲染节流策略（已优化，继续观察）

- **原现状**：`setInterval(fn, 16)` 约 60fps 全量刷新，长文本时 Ink reconciler 压力大。
- **已完成**：刷新间隔调整为约 50ms，并增加内容变化判断，避免相同 `streamingText` 重复 setState。
- **后续可选**：按字符数/行数阈值 flush；对长历史消息做视口裁剪。

### 3.2 `list_dir` 对每个条目调用 `stat`（已优化）

- **原现状**：大目录（如 `node_modules`）时性能较差，原实现通过 `readdir()` 后逐个 `stat()` 判断目录。
- **已完成**：改为 `readdir(dirPath, { withFileTypes: true })`，直接使用 `Dirent` 判断目录，避免每个条目的额外 `stat()`。
- **验证**：已通过 `test/tools/list-dir.test.ts`，目录、文件、空目录、错误路径行为保持兼容。

### 3.3 上下文压缩格式不一致（待处理）

- **现状**：`agent.ts` 内部 `run()` 和 `compressNow()` 两处压缩调用传给 LLM 的消息格式不同。
- **建议**：统一使用 `formatMessagesForSummary()`，并为 tool calls、reasoning content、tool result 编写格式化单测。

### 3.4 `write_file` 结果摘要正则不匹配（已修复）

- **原现状**：`output.ts` 的 `toolResultSummary` 对 `write_file` 用 `/wrote (\d+) bytes/i` 匹配，但 `write.ts` 实际返回 `File written: ${filePath}`。
- **影响**：工具结果摘要永远不显示字节数。
- **已完成**：
  - `write_file` 返回内容已包含 UTF-8 字节数：`File written: <path> (<bytes> bytes)`。
  - `output.ts` 的 `write_file` 摘要正则已同步兼容当前返回格式。
- **验证**：已补充/通过 `test/tools/write.test.ts` 和 `test/cli/output.test.ts`。

---

## 四、功能缺失

### 4.1 无操作日志（待处理）

- **现状**：程序无持久化操作日志，用户出错后难以排查。
- **建议**：在 `.ds-code/logs/` 或用户级 `~/.ds-code/logs/` 下记录结构化 JSONL 日志。
- **建议字段**：时间、sessionId、模型、请求耗时、工具名、工具耗时、错误类型、token/usage（如可得）。
- **安全要求**：默认脱敏 API key、Authorization header、疑似 `sk-` 字符串。

### 4.2 无 usage/cost 精确统计（待处理）

- **现状**：`/cost` 只显示估算 token 数，流式请求中未累积真实 usage。
- **建议**：优先保留估算；若 provider 支持 stream usage，则累积真实 usage；否则在 UI 中明确标注为 estimated。

### 4.3 无 undo 能力（待处理）

- **现状**：文件被修改后无法一键回滚。
- **建议**：
  - P0：`edit_file` 和 `write_file` 执行前自动复制原文件到 `.ds-code/backups/`。
  - P1：增加 `/undo` 命令回滚最近一次文件操作。
- **风险**：大文件备份占用空间；需设计保留策略（如最近 20 次或总大小上限）。

### 4.4 无项目级 agent context 热重载（待处理）

- **现状**：`AGENTS.md` 与 skill metadata 启动时读取，修改后需退出重新进入。
- **建议**：增加 `/reload` 命令重新加载 `AGENTS.md` 和 skill metadata，并更新 system prompt 或后续上下文注入。

### 4.5 未充分利用 Git 上下文（待处理）

- **现状**：`src/utils/git.ts` 提供了 `getGitContext()` 等功能，但 system prompt 中未自动注入 git 状态。
- **建议**：启动时读取分支、status、diff 摘要并注入 system prompt；注意 diff 过长时截断。

### 4.6 无 `.editorconfig` / `.prettierrc`（已优化）

- **原现状**：项目无格式化配置，仅有 ESLint。
- **已完成**：新增 `.editorconfig` 与 `.prettierrc`，统一缩进、换行、引号、分号、尾逗号与行宽等基础格式约定。
- **验证**：已通过 `pnpm test` 与 `pnpm build`。

---

## 五、错误处理与健壮性

### 5.1 `fetchRaw` 中 AbortSignal 与 timeout 竞争（待处理）

- **现状**：`deepseek.ts` 的 `fetchRaw` 同时使用超时 `AbortController` 和外部 `AbortSignal`，清理路径复杂。
- **建议**：使用 `AbortSignal.any()`（需确认 Node 版本）或抽取 `createCombinedSignal()` 工具函数，统一取消原因与清理逻辑。

### 5.2 `finish_reason === 'length'` 可能导致无效循环（待处理）

- **现状**：`agent.ts` 当模型响应被截断时追加 continue 消息；若模型持续返回 `length` 且无新内容，可能在 `maxIterations` 内空耗。
- **建议**：增加连续 `length` 次数上限（如 3 次），超过后提示用户手动 `/compact` 或缩小任务。

### 5.3 权限确认中 `confirm` 决策处理提示不准确（已优化）

- **原现状**：`registry.ts` 对 `permResult.decision === 'confirm'` 直接返回 `Permission denied`。
- **分析**：若 confirm 回调未设置，deny 是安全默认值；但错误消息不准确。
- **已完成**：错误提示改为 `Permission requires confirmation but no confirm callback is set: ...`，便于定位配置问题。
- **验证**：已补充/通过 `test/tools/registry.test.ts`。

### 5.4 `bash.ts` 中 SIGTERM → SIGKILL 的 100ms 等待偏短（待处理）

- **现状**：abort 时先 `SIGTERM`，100ms 后 `SIGKILL`。
- **建议**：增加为 500ms，或通过配置控制；测试覆盖进程中断行为。

### 5.5 `glob.ts` 和 `grep.ts` 的 `DEFAULT_IGNORE` 重复定义（已优化）

- **原现状**：两个文件各自定义相同 ignore 列表。
- **已完成**：提取到共享常量 `src/tools/default-ignore.ts`，由 `glob.ts` 和 `grep.ts` 复用。
- **验证**：已通过 glob/grep 既有测试。

---

## 六、测试覆盖

### 6.1 集成测试薄弱（待处理）

- **现状**：`test/integration/` 存在，但端到端 Agent 循环覆盖仍有限。
- **建议**：增加 mock API 的完整对话流程测试：纯文本、工具调用、权限确认、工具错误、压缩、abort。

### 6.2 缺少 Ink 组件测试（待处理）

- **现状**：React/Ink 组件（`MessageList`、`StreamingText`、`ToolCallDisplay`、`PermissionPrompt`、`Autocomplete`、`StatusIndicator`）测试较少或缺失。
- **建议**：使用 `ink-testing-library`；若引入成本较高，先抽纯逻辑函数并测试。

### 6.3 Skills 模块测试覆盖需持续确认（继续观察）

- **现状**：Skills 已有 matcher、loader、formatter 等模块，但需持续防止 plan 与实现偏差。
- **建议**：确保 metadata/frontmatter/activation/matcher/registry 的成功、失败、warning 场景均有测试。

---

## 七、安全

### 7.1 Write/edit 工具未限制写入路径（P0，已修复）

- **原现状**：`write_file` 和 `edit_file` 接受任意绝对路径，Agent 理论上可写入系统敏感目录。
- **风险**：误写系统文件、SSH key、全局配置等。
- **已完成**：
  1. 新增 `src/tools/path-safety.ts`，默认仅允许写入当前工作区根目录内；测试/工具场景可通过 `DS_CODE_WORKSPACE_ROOT` 覆盖工作区根目录。
  2. 默认拒绝 Unix 敏感目录（如 `/etc`、`/usr`、`/bin`、`/root`、`/var` 等）、Windows 敏感首段（如 `Windows`、`Program Files`、`ProgramData`）以及 `.ssh` 目录。
  3. `write_file` / `edit_file` 在实际写入前调用路径安全校验，不安全路径返回 `isError: true`。
  4. 已处理 Windows 下 Unix 风格路径（如 `/etc/hosts`）被 `resolve()` 转换后绕过检测的问题：同时检查原始输入路径和解析后路径。
- **验证**：已补充/通过 `test/tools/path-safety.test.ts`、`test/tools/write.test.ts`、`test/tools/edit.test.ts`，覆盖 Windows/Unix 风格路径与项目外路径。
- **后续可选**：引入配置化 `permissions.allowedPaths`，支持用户显式扩展可写白名单，并在权限提示中展示是否越界。

### 7.2 危险命令检测可绕过（待处理）

- **现状**：`rules.ts` 用正则匹配危险命令，但变体可能绕过。
- **建议**：持续补充正则库；未来可考虑沙箱执行选项（Docker/容器）或 dry-run。

### 7.3 API Key 可能出现在错误日志中（待处理，依赖 4.1）

- **现状**：若增加日志功能，`ApiError.responseBody` 或错误消息可能包含敏感信息。
- **建议**：日志落盘前统一调用 `redactSecrets()`，对 Authorization header、`sk-`、`Bearer` token 等做掩码。

---

## 八、文档与规范

### 8.1 README 示例中空格异常（已优化）

- **原现状**：`README.md` 部分命令前有额外空格（如 ` ds-code --model reasoner`）。
- **已完成**：已移除 README 使用示例中命令前的多余空格，避免复制命令时带入异常字符。
- **验证**：已通过 `pnpm test` 与 `pnpm build`。

### 8.2 `CLAUDE.md` 与实际代码有偏差（待处理）

- **现状**：`CLAUDE.md` 提到工具层返回 `ToolResult`，但实际 `isError` 字段在多个成功场景下为 `undefined`（类型为 `isError?: boolean`）。
- **建议**：二选一：
  - 代码层统一成功返回 `isError: false`；或
  - 文档明确 `undefined` 等价于 false。

### 8.3 Skills plan 与实际实现差异（待处理）

- **现状**：`docs/skills-implementation-plan.md` 定义了多个 Phase，但实际实现已完成大部分，包括 model-based matching。
- **建议**：更新 plan 文档标注各 Phase 完成状态，或归档为历史设计文档。

---

## 九、优先级矩阵

| 优先级 | 类别 | 问题编号 | 简述 | 影响范围 | 状态 |
|--------|------|----------|------|----------|------|
| P0 | Bug | 1.7 | always write 不生效 | 用户体验 | 已修复 |
| P0 | Bug | 1.6 | Markdown 渲染重复 | 输出正确性 | 已初步优化，继续观察 |
| P0 | Bug | 3.4 | write_file 结果摘要不匹配 | 工具结果 | 已修复 |
| P0 | 健壮性 | 2.9 | 初始化错误被吞噬 | 可观测性 | 已修复 |
| P0 | 安全 | 7.1 | 写入路径未限制 | 安全性 | 已修复 |
| P1 | 性能 | 1.3 / 3.1 | 输出抖动、流式刷新过频 | 用户体验/性能 | 已优化，继续观察 |
| P1 | 体验 | 1.8 | 修改无 diff 对比 | 用户体验 | 已优化 |
| P1 | 体验 | 1.9 | 流式 Markdown 未渲染 | 阅读体验 | 已初步优化，继续观察 |
| P1 | 代码 | 2.1 | app.tsx 过大 | 可维护性 | 已优化 |
| P1 | 代码 | 2.4 | isBinary 重复 | 可维护性 | 已优化 |
| P1 | 代码 | 2.5 | isReadOnlyTool 硬编码 | 可维护性/并行策略 | 已优化 |
| P1 | Bug | 1.1 | Skills 用完未清理 | 权限安全 | 已优化 |
| P2 | 功能 | 4.1 | 无操作日志 | 可观测性 | 待处理 |
| P2 | 功能 | 4.3 | 无 undo 能力 | 用户体验 | 待处理 |
| P2 | 性能 | 3.2 | list_dir 大目录 stat 过多 | 性能 | 已优化 |
| P2 | 代码 | 2.2 | 无依赖注入/组装层 | 可测试性 | 待处理 |
| P2 | 代码 | 2.3 | dev.js 残留旧入口 | 可维护性 | 已优化 |
| P2 | 代码 | 2.6 | serializeMessages 未使用 | 可维护性 | 已优化 |
| P2 | 代码 | 5.5 | glob/grep 默认 ignore 重复 | 可维护性 | 已优化 |
| P2 | 健壮性 | 5.3 | confirm 缺失时提示不准确 | 可诊断性 | 已优化 |
| P3 | 文档 | 8.1 | README 格式 | 形象 | 已优化 |
| P3 | 文档 | 4.6 | 格式化配置缺失 | 贡献规范 | 已优化 |
| P3 | 功能 | 1.2 | 上下文索引存档 | 扩展性 | 暂缓 |
| P3 | 安全 | 7.2 | 危险命令绕过 | 安全性 | 待处理 |

---

## 十、建议的下一轮执行计划

### Sprint 1：先补 P0 可观测性与安全边界（已完成）

1. 初始化错误静默吞噬已修复：`initError` 状态 + UI 展示 + 单测。
2. `write_file` / `edit_file` 已增加最小路径安全边界，默认拒绝项目外与敏感系统路径。
3. 敏感信息脱敏工具仍建议作为后续操作日志（4.1 / 7.3）的前置工作推进。

### Sprint 2：降低维护成本（部分完成）

1. `createAgentDeps()` 仍待提取，为后续拆分 `app.tsx` 打基础。
2. 统一 `agent.ts` 压缩摘要格式仍待处理。
3. binary 判断和 ignore 常量已提取：`src/utils/binary.ts`、`src/tools/default-ignore.ts`。
4. read-only 工具判断已改为 registry/Tool 元数据驱动。
5. `list_dir` 已改为 `readdir(..., { withFileTypes: true })`，减少大目录额外 stat。
6. token 估算已加入 20% 保守余量。
7. confirm callback 缺失时的错误提示已优化。
8. `dev.js` 已改为新版 CLI 入口，避免引用不存在的旧 REPL。
9. 未使用的 `serializeMessages()` 已移除，减少冗余 API。

### Sprint 3：体验增强（待推进）

1. 流式 Markdown 增量渲染 POC 已初步完成，后续继续观察复杂 Markdown 与长输出性能。
2. 操作日志 JSONL。
3. 文件备份与 `/undo` MVP。
4. CLAUDE / skills plan 文档同步。
5. README 示例格式已修正，并已新增 `.editorconfig` / `.prettierrc`。

---

## 十一、总结

项目整体架构清晰，模块划分合理（api / cli / core / config / permissions / skills / tools / utils），Skills 系统采用的渐进式加载设计良好。

本轮已优先解决一批高影响项：

1. **权限系统**：修复 "Always" 对非 bash 写工具不生效的问题，并支持持久化到项目 `.ds-code/settings.json`；增强 Skills 临时权限作用域清理；read-only 工具并行策略已改为 Tool 元数据驱动。
2. **CLI 渲染层**：降低流式输出刷新频率，增加内容变化判断，缓解长输出抖动；对 Markdown 重复渲染做了初步排查/小修，并已支持流式 Markdown 增量渲染。
3. **工具可观测性与安全性**：`edit_file` 返回 diff，`write_file` 返回字节数且 CLI 摘要可正确展示；`write_file` / `edit_file` 已加入默认路径安全边界，拒绝项目外与敏感系统路径。
4. **Agent 行为约束**：默认 system prompt 已要求临时脚本放到 `.ds-code/scripts/`，并要求执行非 Node 脚本前检查运行时。
5. **维护性与性能**：binary 判断与 glob/grep 默认 ignore 已提取为共享模块；`list_dir` 已改为 Dirent 模式减少 stat；token 估算已加入 20% 保守余量；权限确认缺失时的错误提示更清晰；旧 `dev.js` 入口已修正，未使用的 `serializeMessages()` 已移除。
6. **文档与规范**：README 命令示例空格已修正，并新增 `.editorconfig` / `.prettierrc` 统一基础格式约定。

剩余主要短板集中在：

1. **可观测性**：操作日志尚未建立，敏感信息脱敏工具仍需补齐。
2. **可维护性**：`app.tsx` 仍需拆分为更小、可测试的单元；`createAgentDeps()` 与运行时 hook 尚未提取。
3. **Agent 健壮性**：上下文压缩格式仍需统一；`finish_reason === 'length'` 连续截断场景仍需保护。
4. **体验增强**：上下文归档/索引、undo 能力建议后续单独设计推进；流式 Markdown 已初步支持，仍需观察复杂场景表现。
