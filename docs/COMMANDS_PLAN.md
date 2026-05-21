# Slash Commands 实现计划

## 现状分析

`commands.ts` 定义了 12 个命令，仅 4 个有实现（`/help`, `/clear`, `/status`, `/version`），其余 8 个落入 default 分支显示 "Unknown command"。

### 已实现但需优化

| 命令 | 问题 |
|------|------|
| `/clear` | 只清 UI messages，未重置 Agent 内部 messages/contextManager |
| `/status` | 信息太少，应显示模型、token 用量、工具数 |

### 待实现

| 命令 | 功能 | 复杂度 |
|------|------|--------|
| `/exit` | 退出程序 | 低 |
| `/model` | 查看/切换模型（`/model` 查看，`/model flash` 切换） | 中 |
| `/tools` | 列出已注册工具及描述 | 低 |
| `/resume` | 运行时恢复上次会话 | 中 |
| `/compact` | 手动触发上下文压缩 | 中 |
| `/cost` | 显示本次会话 token 估算 | 低 |
| `/doctor` | 检查运行环境（Node 版本、API key、磁盘空间等） | 低 |
| `/memory` | 显示 system prompt 摘要 | 低 |

### Bug 修复

- `registry.ts:65-68` — permission `confirm` 分支应调用 `this.confirm()` 而非直接 deny

---

## 实现顺序

### Phase 1: 简单命令 + Bug 修复

1. **修复 permission confirm 逻辑** — `registry.ts`
2. `/exit` — 调用 `exit()` 退出 Ink
3. `/tools` — 从 registry 列出工具名 + 描述
4. `/cost` — 从 agent messages 估算 token
5. `/doctor` — 检查 Node 版本、API key 存在性、sessions 目录

### Phase 2: 需要 Agent 交互的命令

6. `/clear` 优化 — 同时重置 Agent messages
7. `/status` 优化 — 增加模型、token、工具数信息
8. `/model [name]` — 查看或切换模型
9. `/memory` — 显示当前 system prompt 前 200 字符
10. `/compact` — 手动触发 contextManager.compress()
11. `/resume` — 运行时恢复会话（加载历史到 Agent）

---

## 实现细节

### 架构调整

`handleCommand` 当前只能 `setCommandOutput()`，无法访问 agent/registry/client。需要将 `agentRef`、`registry`、`client` 暴露给命令处理器。

方案：将 registry 和 client 存入 ref，handleCommand 直接使用闭包中的 ref。

### 各命令实现

**`/exit`**
```tsx
case '/exit':
  exit()
  break
```

**`/tools`**
```tsx
case '/tools':
  const tools = registryRef.current.list()
  setCommandOutput(tools.map(t => `  ${t.name.padEnd(12)} ${t.description}`).join('\n'))
  break
```

**`/cost`**
```tsx
case '/cost':
  const msgs = agentRef.current.getMessages()
  const tokens = estimateMessagesTokens(msgs)
  setCommandOutput(`Estimated tokens: ${tokens}`)
  break
```

**`/doctor`**
```tsx
case '/doctor':
  const checks = [
    `Node: ${process.version}`,
    `API Key: ${apiKey ? '✓ set' : '✗ missing'}`,
    `CWD: ${process.cwd()}`,
    `Platform: ${process.platform} ${process.arch}`,
    `Session: ${sessionRef.current?.id ?? 'none'}`,
  ]
  setCommandOutput(checks.join('\n'))
  break
```

**`/model [name]`**
```tsx
case '/model':
  if (parts[1]) {
    try {
      const newModel = clientRef.current.setModel(parts[1])
      setCommandOutput(`Switched to: ${newModel}`)
    } catch (e) {
      setCommandOutput(e.message)
    }
  } else {
    setCommandOutput(`Current model: ${clientRef.current.getModel()}`)
  }
  break
```

**`/clear` 优化**
```tsx
case '/clear':
  setMessages([])
  agentRef.current.resetMessages()  // 新增 Agent 方法
  setCommandOutput('Conversation cleared.')
  break
```

**`/compact`**
```tsx
case '/compact':
  // 触发压缩，异步
  setCommandOutput('Compressing context...')
  agentRef.current.compress().then(...)
  break
```

**`/resume`**
```tsx
case '/resume':
  const session = await sessionStoreRef.current.resumeLatest()
  if (session) {
    agentRef.current.loadMessages(session.messages)
    sessionRef.current = session
    setCommandOutput(`Resumed session: ${session.id}`)
  } else {
    setCommandOutput('No previous session found.')
  }
  break
```

**`/memory`**
```tsx
case '/memory':
  const sysMsg = agentRef.current.getMessages().find(m => m.role === 'system')
  const preview = sysMsg?.content?.slice(0, 200) ?? 'No system prompt'
  setCommandOutput(`System prompt:\n${preview}...`)
  break
```
