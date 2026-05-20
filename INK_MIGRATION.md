# ds-code CLI 迁移至 Ink 方案

## 1. 目标

将 `src/cli/` 从 readline + ANSI 手动控制迁移到 Ink（React for CLI），获得：

- 声明式 UI，组件化开发
- 更容易实现复杂布局（并行任务面板、split view）
- 社区组件生态（spinner、text-input、select）
- 更好的可测试性（组件可单独渲染测试）

## 2. 新增依赖

```
ink                 ^5.x      # React 渲染引擎
react               ^18.x     # JSX 运行时
ink-text-input      ^6.x      # 文本输入组件
ink-spinner         ^5.x      # 加载动画
@types/react        ^18.x     # 类型
```

移除：`ora`（不再需要）

## 3. 架构设计

### 3.1 组件树

```
<App>
├── <MessageList />           # 历史消息展示（Static，已输出不再重绘）
│   ├── <UserMessage />
│   ├── <AssistantMessage />  # Markdown 渲染
│   └── <ToolCallBlock />     # 工具调用 + 结果摘要
├── <ActiveResponse />        # 当前正在流式输出的响应
│   ├── <Spinner />           # 等待 / thinking 状态
│   └── <StreamingText />     # 逐 chunk 累积的文本
├── <PermissionPrompt />      # 权限确认（条件渲染）
├── <Autocomplete />          # 斜杠命令补全提示
└── <InputBar />              # 用户输入框
```

### 3.2 状态管理

使用 React hooks，不引入外部状态库：

```typescript
// App 顶层状态
const [messages, setMessages] = useState<DisplayMessage[]>([])
const [streaming, setStreaming] = useState<string>('')
const [status, setStatus] = useState<'idle' | 'thinking' | 'streaming' | 'tool'>('idle')
const [permissionRequest, setPermissionRequest] = useState<PermReq | null>(null)
const [inputValue, setInputValue] = useState('')
const [multiline, setMultiline] = useState(false)
```

### 3.3 流式输出策略

Ink 每次 setState 触发全量重绘。逐字符 setState 会导致性能问题。

**方案：批量累积 + 节流渲染**

```typescript
// 在 agent callbacks 中：
onContent: (chunk) => {
  bufferRef.current += chunk
}

// 用 useEffect + interval 节流刷新（每 16ms 一帧）
useEffect(() => {
  const id = setInterval(() => {
    if (bufferRef.current !== lastFlushed.current) {
      setStreaming(bufferRef.current)
      lastFlushed.current = bufferRef.current
    }
  }, 16)
  return () => clearInterval(id)
}, [])
```

流结束后将完整文本移入 `<Static>` 区域的 messages 列表，不再重绘。

### 3.4 输入处理

```typescript
<InputBar>
  // 使用 ink-text-input
  // 支持 """ 多行模式切换
  // Enter 提交
  // 输入 / 开头时激活 <Autocomplete>
</InputBar>
```

Ctrl+C / Ctrl+D 通过 Ink 的 `useInput()` hook 捕获。

### 3.5 权限确认

```typescript
<PermissionPrompt request={permissionRequest} onResolve={handlePermission} />
// 渲染：工具名 + 参数摘要 + [Y]es / [A]lways / [N]o
// useInput() 监听单键
// resolve 后隐藏组件，继续 agent 循环
```

Agent 循环中权限确认通过 Promise 挂起：

```typescript
const confirm = (tool, args) => new Promise(resolve => {
  setPermissionRequest({ tool, args, resolve })
})
```

### 3.6 斜杠命令补全

```typescript
<Autocomplete matches={matches} selectedIndex={idx} />
// 条件渲染在 InputBar 下方
// 上下键切换 selectedIndex
// Tab 填充选中项到 input
// 纯 React 状态驱动，不再手动操作 ANSI 光标
```

## 4. 文件结构变更

```
src/cli/
├── index.ts                  # 导出 startApp()
├── app.tsx                   # <App> 根组件
├── components/
│   ├── message-list.tsx      # 历史消息（Static）
│   ├── assistant-message.tsx # Markdown 渲染
│   ├── streaming-text.tsx    # 流式文本 + 节流
│   ├── input-bar.tsx         # 文本输入
│   ├── autocomplete.tsx      # 斜杠命令补全
│   ├── permission-prompt.tsx # 权限确认
│   ├── spinner.tsx           # 状态指示
│   └── tool-call.tsx         # 工具调用展示
├── hooks/
│   ├── use-agent.ts          # Agent 执行逻辑封装
│   ├── use-streaming.ts      # 流式累积 + 节流
│   └── use-session.ts        # 会话管理
├── commands.ts               # 保留（纯逻辑）
├── input.ts                  # 保留（纯解析）
├── model.ts                  # 保留（纯逻辑）
└── output.ts                 # renderMarkdown 保留，其余迁入组件
```

## 5. 不变的部分

| 模块 | 原因 |
|------|------|
| `src/core/agent.ts` | 回调接口不变，UI 层只是换了回调实现 |
| `src/api/*` | 纯网络层，与 UI 无关 |
| `src/tools/*` | 工具执行逻辑不变 |
| `src/permissions/manager.ts` | 逻辑不变，confirm 回调由 Ink 组件提供 |
| `src/core/session.ts` | 纯文件 I/O |
| `src/core/context.ts` | 纯逻辑 |
| `bin/ds-code.ts` | 改为调用 `startApp()` 替代 `startRepl()` |

## 6. 实施步骤

### Step 1：基础设施

- 安装依赖：`ink`, `react`, `@types/react`, `ink-text-input`, `ink-spinner`
- `tsconfig.json` 添加 `"jsx": "react-jsx"`
- `tsup.config.ts` 确认支持 `.tsx` 文件

### Step 2：最小可用 App

- 创建 `app.tsx`：静态欢迎信息 + `<InputBar>` + 提交后调用 agent
- 创建 `use-agent.ts` hook：封装 agent.run() + 回调
- `bin/ds-code.ts` 改为 `render(<App />)`
- 此时功能等价于当前 REPL 的基础对话

### Step 3：流式输出

- 实现 `<StreamingText>` + `use-streaming.ts`
- 节流渲染，流结束后移入 Static

### Step 4：工具调用展示

- 实现 `<ToolCallBlock>` 组件
- spinner 状态切换

### Step 5：权限确认

- 实现 `<PermissionPrompt>` 组件
- Promise-based 挂起/恢复

### Step 6：斜杠命令补全

- 实现 `<Autocomplete>` 组件
- 复用 `commands.ts` 的匹配逻辑

### Step 7：多行输入 + 会话恢复

- InputBar 支持 `"""` 模式
- `use-session.ts` 接入 SessionStore

### Step 8：清理

- 删除旧文件：`repl.ts`, `spinner.ts`, `slash-autocomplete.ts`, `permission-prompt.ts`
- 移除 `ora` 依赖
- 更新 `src/cli/index.ts` 导出
- 更新测试

## 7. 风险与应对

| 风险 | 应对 |
|------|------|
| 流式渲染性能（高频 setState） | 16ms 节流 + useRef buffer，只在帧边界更新 |
| Ink 不支持 marked-terminal 直接输出 | 保留 renderMarkdown 返回 ANSI string，用 `<Text>` 包裹 |
| ink-text-input 不支持多行 | 自己管理多行 buffer，单行组件只显示当前行 |
| 测试复杂度增加 | 用 ink-testing-library 做组件测试 |
| Windows 终端兼容性 | Ink 内部处理了大部分兼容，比手动 ANSI 更可靠 |

## 8. 验证标准

- `pnpm build` 编译通过（tsx 文件正确处理）
- `pnpm dev` 启动后：
  - 显示欢迎信息
  - 输入文本 → 流式输出响应
  - `/` 开头显示补全
  - 工具调用显示名称 + 结果摘要
  - 写操作触发权限确认
  - Ctrl+C 中断当前请求
  - Ctrl+D 退出
  - `"""` 多行输入正常
  - `--resume` 恢复会话
- 现有 `test/cli/` 测试适配后通过
