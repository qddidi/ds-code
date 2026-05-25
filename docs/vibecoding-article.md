# vibecoding实战：用 Claude Code 从0到1开发一个 Claude Code

> 这篇文章想记录一次真实的 AI 编程实践：我不是先打开编辑器一行行写代码，而是用 Claude Code 作为主力开发助手，先让它产出 PRD，再让它设计技术方案、拆实现模块和测试计划，然后针对项目生成专用 skills，最后按模块推进开发。过程中 AI 完成了大量实现，但交互体验这类细节，最后还是需要自己上手测试、反复调整。

如果你用过 Claude Code，应该会对它的工作方式印象很深：你在终端里描述需求，它能读项目、搜代码、改文件、跑测试，并根据结果继续迭代。

于是我有了一个想法：

> 能不能用 Claude Code，开发一个自己的 Claude Code？

最终做出来的项目叫 **ds-code**。它是一个基于 Node.js + TypeScript 的终端 AI 编程助手 CLI，支持 DeepSeek、OpenAI 和 OpenAI-compatible API，可以在终端里与 AI 对话，并通过工具完成读文件、改代码、搜索项目、执行命令、管理上下文等任务。

这篇文章不是一篇“AI 一键生成项目”的爽文。真实情况是：AI 很强，但它不是产品经理、架构师、测试同学和用户体验设计师的总和。更准确地说，这次开发像是一次人和 AI 的分工协作：

- 我负责目标、边界、验收和体验判断；
- Claude Code 负责文档初稿、方案拆解、模块实现、测试补齐和错误修复；
- 工程化命令负责兜底，比如 typecheck、lint、test、build；
- 最后的交互体验，需要我自己实际使用后不断打磨。

这就是我理解的 vibecoding：不是让 AI 替你思考一切，而是用 AI 把想法快速推到可运行、可验证、可迭代的状态。

***

## 一、先说结论：这次开发流程是什么？

这次 ds-code 的开发流程大概是这样的：

```text
想法产生
  → 用 Claude Code 生成 PRD
  → 基于 PRD 生成技术方案
  → 拆实现模块、里程碑和测试计划
  → 为这个项目生成 Claude Code skills
  → 按模块逐个实现
  → 每个模块配测试和质量检查
  → 跑通整体功能
  → 自己真实使用
  → 调整 AI 做得不好的交互体验
  → 完成 README、文档和发布准备
```

这个流程里，我认为最关键的不是“写代码”那一步，而是前面的三件事：

1. **先有 PRD**：让 AI 明确产品到底要解决什么问题；
2. **再有技术方案**：让 AI 不要想到哪写到哪；
3. **最后有 skills**：把常见开发任务沉淀成可复用工作流。

如果直接对 Claude Code 说：

```text
帮我写一个 Claude Code
```

它也许能生成一堆代码，但大概率会出现这些问题：

- 模块边界混乱；
- 功能遗漏；
- 测试缺失；
- 安全权限没设计好；
- 写到后面上下文丢失；
- 交互体验不一致；
- 文档和实现对不上。

所以我的真实经验是：**vibecoding 不是少做设计，而是更需要先做设计。**

***

## 二、项目最终做成了什么？

ds-code 是一个 npm CLI 包，安装后可以直接在终端启动：

```bash
npm install -g @mrdistore/ds-code

ds-code
```

也可以带初始 prompt：

```bash
ds-code "帮我看看这个项目的结构"
```

指定模型：

```bash
ds-code --provider openai --model gpt-4o
```

使用 OpenAI-compatible 中转站：

```bash
ds-code --provider custom --base-url https://relay.example.com --model openai/gpt-4o
```

恢复上次会话：

```bash
ds-code --resume
```

目前它具备这些能力：

- 交互式终端 UI；
- 流式输出；
- Agent 工具调用循环；
- 文件读取、写入、精确编辑；
- glob、grep、list\_dir 项目搜索；
- bash 命令执行；
- 写文件和执行命令前的权限确认；
- 危险命令拦截；
- DeepSeek / OpenAI / custom provider；
- 多模型切换；
- 长上下文自动压缩；
- 会话保存与恢复；
- slash commands；
- skills 机制；
- Vitest 测试覆盖。

内置工具包括：

| 工具           | 作用          | 权限          |
| ------------ | ----------- | ----------- |
| `read_file`  | 读取文件，支持行范围  | 自动允许        |
| `write_file` | 创建或覆盖文件     | 需要确认        |
| `edit_file`  | 精确字符串替换     | 需要确认        |
| `glob`       | 按文件名模式搜索    | 自动允许        |
| `grep`       | 正则搜索文件内容    | 自动允许        |
| `list_dir`   | 列出目录        | 自动允许        |
| `bash`       | 执行 shell 命令 | 需要确认 / 可白名单 |

内置命令包括：

| 命令         | 作用          |
| ---------- | ----------- |
| `/help`    | 查看帮助        |
| `/clear`   | 清空对话        |
| `/exit`    | 退出          |
| `/model`   | 切换模型        |
| `/status`  | 查看状态        |
| `/tools`   | 列出工具        |
| `/cost`    | 查看 token 估算 |
| `/compact` | 手动压缩上下文     |
| `/resume`  | 恢复会话        |
| `/doctor`  | 检查运行环境      |
| `/version` | 查看版本        |

这已经不是一个玩具 demo，而是一个可以真实使用的终端 AI Agent。

***

## 三、第一步：先让 Claude Code 写 PRD

很多人用 AI 写代码，一上来就让它生成实现。但我这次刻意先让 Claude Code 写 PRD。

因为 PRD 的作用不是为了“正式”，而是为了让 AI 和我对齐产品边界。

我给 Claude Code 的方向大概是：

```text
我要开发一个类似 Claude Code 的终端 AI 编程助手。
支持 DeepSeek、OpenAI 和 OpenAI-compatible API。
用户可以在终端和 AI 对话，AI 可以读取文件、搜索项目、编辑文件、执行命令。
需要有权限控制、上下文管理、会话恢复、slash commands、测试和发布能力。
请先输出一份 PRD。
```

PRD 里我重点让它描述这些内容：

- 产品定位；
- 目标用户；
- 核心场景；
- 功能范围；
- 非目标范围；
- 安全边界；
- 配置方式；
- 使用路径；
- 验收标准。

这一步非常重要。因为没有 PRD，AI 很容易把项目写成“一个能调用模型的命令行聊天工具”；有了 PRD，它才知道目标是“一个能实际操作工程项目的 Agent”。

PRD 阶段我会不断追问：

```text
哪些功能是 MVP 必须有的？
哪些功能可以放到后续版本？
写文件和执行命令的安全边界是什么？
用户第一次启动时应该怎么配置 API Key？
如果上下文很长怎么办？
如果命令执行失败怎么办？
```

这些问题看似和代码无关，但决定了后面代码怎么写。

***

## 四、第二步：让 Claude Code 出技术方案

PRD 明确后，我继续让 Claude Code 基于 PRD 输出技术方案。

技术方案主要包括：

- 技术选型；
- 目录结构；
- 核心模块；
- Agent 循环；
- API 封装；
- 工具系统；
- 权限模型；
- 上下文压缩；
- 会话管理；
- 配置系统；
- 测试策略；
- 风险和应对。

最终项目技术栈是：

| 类别       | 选型                       | 原因                      |
| -------- | ------------------------ | ----------------------- |
| 运行时      | Node.js >= 20            | 原生 fetch、ESM 支持好，适合 CLI |
| 语言       | TypeScript               | 类型约束适合复杂 Agent 系统       |
| CLI UI   | Ink + React              | 用 React 组件化方式开发终端 UI    |
| 输入       | ink-text-input           | 处理交互式输入                 |
| Markdown | marked + marked-terminal | 终端内渲染 Markdown          |
| 代码高亮     | cli-highlight            | 代码块高亮展示                 |
| 文件搜索     | fast-glob                | 高性能文件匹配                 |
| 构建       | tsup                     | 快速打包 ESM CLI            |
| 测试       | Vitest                   | 单元测试和集成测试               |
| 包管理      | pnpm                     | 依赖管理稳定高效                |

项目结构设计成这样：

```text
ds-code/
├── bin/
│   └── ds-code.tsx
├── src/
│   ├── api/
│   │   ├── deepseek.ts
│   │   ├── retry.ts
│   │   ├── stream.ts
│   │   └── types.ts
│   ├── cli/
│   │   ├── app.tsx
│   │   ├── commands.ts
│   │   ├── input.ts
│   │   ├── model.ts
│   │   ├── options.ts
│   │   └── components/
│   ├── config/
│   │   ├── defaults.ts
│   │   ├── loader.ts
│   │   └── schema.ts
│   ├── core/
│   │   ├── agent.ts
│   │   ├── context.ts
│   │   ├── message.ts
│   │   └── session.ts
│   ├── permissions/
│   │   ├── manager.ts
│   │   └── rules.ts
│   ├── tools/
│   │   ├── bash.ts
│   │   ├── edit.ts
│   │   ├── glob.ts
│   │   ├── grep.ts
│   │   ├── list-dir.ts
│   │   ├── read.ts
│   │   ├── registry.ts
│   │   ├── types.ts
│   │   └── write.ts
│   └── utils/
│       ├── git.ts
│       └── token-count.ts
└── test/
```

这一步的价值是让项目先有“骨架”。后面每个模块的实现都能放到对应位置，不会越写越乱。

***

## 五、第三步：拆实现模块和测试计划

有了技术方案以后，我没有马上开始写代码，而是继续让 Claude Code 把项目拆成模块。

最终拆出来的模块大概是：

| 编号  | 模块         | 关键路径                                          |
| --- | ---------- | --------------------------------------------- |
| M01 | 项目基础设施     | `/`, `bin/`                                   |
| M02 | API 客户端    | `src/api/`                                    |
| M03 | 消息与类型      | `src/core/message.ts`, `src/api/types.ts`     |
| M04 | 工具系统框架     | `src/tools/types.ts`, `src/tools/registry.ts` |
| M05 | Agent 核心循环 | `src/core/agent.ts`                           |
| M06 | CLI 交互层    | `src/cli/`                                    |
| M07 | 文件操作工具     | `src/tools/read.ts`, `write.ts`, `edit.ts`    |
| M08 | 搜索工具       | `src/tools/glob.ts`, `grep.ts`, `list-dir.ts` |
| M09 | Bash 工具    | `src/tools/bash.ts`                           |
| M10 | 权限系统       | `src/permissions/`                            |
| M11 | 配置管理       | `src/config/`                                 |
| M12 | 上下文管理      | `src/core/context.ts`                         |
| M13 | 会话管理       | `src/core/session.ts`                         |
| M14 | Git 集成     | `src/utils/git.ts`                            |
| M15 | 多模型支持      | `src/api/deepseek.ts`, `src/cli/model.ts`     |
| M16 | 错误重试       | `src/api/retry.ts`                            |
| M17 | Skills 实现  | `src/skills/`, `src/cli/`                     |
| M18 | Token 计数   | `src/utils/token-count.ts`                    |

同时，每个模块都要求配测试。

这里我后来又单独把 **Skills 实现** 拆成了 M17。因为一开始 skills 只是作为 Claude Code 里的开发辅助能力存在，但做到后面我发现，ds-code 自己也应该支持类似机制：用户不用每次都写完整 prompt，常见任务可以被自动识别和激活。

M17 主要包含这些内容：

- skill 定义和加载；
- skill 开关配置；
- 本地规则匹配；
- 必要时调用模型做 skill 匹配；
- 匹配成功后请求用户确认；
- 与 CLI 输入流程、命令补全和会话记录集成；
- 为匹配、确认、禁用、误触发等场景补测试。

测试计划不是最后才补的，而是在模块拆分时一起写出来：

| 模块          | 测试重点                             |
| ----------- | -------------------------------- |
| API         | 请求体、SSE 解析、tool calls、错误分类、重试、中断 |
| Agent       | 流式回调、工具循环、只读并行、错误工具结果、上下文压缩      |
| Context     | token 估算、压缩策略、消息保留               |
| Session     | 保存、恢复、损坏 JSON 容错                 |
| CLI         | 输入解析、命令匹配、模型切换、Markdown 渲染       |
| Tools       | 文件读写、grep、glob、bash 输出、超时、中断     |
| Permissions | 默认决策、危险命令、白名单、always allow       |
| Config      | 默认配置、全局/项目合并、CLI/env 覆盖          |
| Skills      | 本地匹配、模型匹配、确认流程、禁用开关、误触发处理       |

这一步对 AI 开发特别关键。

因为 AI 很容易“实现功能”，但不一定会主动补全测试边界。提前把测试计划写出来，等于给每个模块都加了验收标准。

***

## 六、第四步：为项目生成 Claude Code skills

这是这次开发里我觉得最有价值的一步。

在正式进入模块开发前，我让 Claude Code 为这个项目生成了一组专用 skills。

为什么要这么做？

因为开发过程中会反复出现一些固定任务，比如：

- 修 bug；
- 加工具；
- 补测试；
- 做重构；
- 审查改动；
- 准备发布；
- 根据文档实现模块。

如果每次都临时写 prompt，很容易遗漏项目约束。skills 的作用就是把这些高频工作流固化下来。

例如这个项目里的 skills 包括：

| Skill            | 用途                      |
| ---------------- | ----------------------- |
| `debug`          | 诊断并修复可复现 bug 或异常行为      |
| `dependency`     | 添加或调整 npm 依赖并完成配置       |
| `implementation` | 按 docs 中的模块、计划或明确需求实现功能 |
| `refactor`       | 对指定模块做行为保持的重构           |
| `release`        | 构建并准备发布新版本              |
| `review`         | 审查当前分支、未提交改动或最新提交       |
| `test`           | 为指定模块或行为编写、补充或修复测试      |
| `tool`           | 添加或修改 Tool，并补充注册、权限和测试  |

有了 skills 后，后续开发就不需要每次都写一大段提示词。更重要的是，Claude Code 可以根据用户输入自动触发合适的 skill。

例如我直接说：

```text
按 docs 中 M04 实现工具系统框架，补充测试
```

Claude Code 会自动判断这是一个 implementation 类任务。

再比如：

```text
为权限系统补充危险命令和 allowedCommands 优先级测试
```

它会自动进入 test 类工作流。

或者：

```text
看下当前 git 改动，有没有安全风险和测试遗漏
```

它会自动进入 review 类工作流。

这比每次手动输入斜杠命令更自然，也更接近真实使用习惯。skills 真正有价值的地方，不只是“可以手动调用”，而是它让 Claude Code 能把普通自然语言映射到一套更稳定的项目级 SOP。

我的经验是：**当项目进入多轮 AI 协作时，skills 就像给 AI 配了一套项目级 SOP。**

***

## 七、第五步：按模块开发，而不是让 AI 一把梭

真正写代码时，我基本按照模块推进。

因为前面已经有了 PRD、技术方案、模块拆分和 skills，这一阶段的提示词反而不需要写得特别细。只要告诉 Claude Code 当前要推进哪个模块，它通常会自己去读 docs、查相关文件、实现代码、补测试，然后运行必要的检查。

比如我会这样说：

```text
按 M01 推进项目基础设施。
```

再做 API 客户端：

```text
继续实现 M02 API 客户端。
```

再做工具系统：

```text
推进 M04 工具系统框架。
```

再做 Agent 循环：

```text
实现 M05 Agent 核心循环。
```

如果中间发现问题，再补一句约束就够了：

```text
保持现有接口兼容，补测试，完成后跑 typecheck 和 test。
```

也就是说，前期文档和 skills 越完整，后期 prompt 就可以越短。Claude Code 不需要我每次把接口、路径、测试点全部重复一遍，它会基于项目上下文和 skill 规则自己完成大部分细节。

我真正需要做的是控制节奏：一次只推进一个模块，确认通过后再进入下一个模块。

***

## 八、核心一：Agent 循环怎么设计？

Claude Code-like 工具的核心不是聊天框，而是 Agent 循环。

ds-code 的 Agent 循环大概是：

```text
用户输入
  → 追加 user message
  → 检查并按需压缩上下文
  → 调用 OpenAI-compatible chat completions stream
  → 渲染文本 / thinking / tool call 状态
  → 如果模型请求 tool_calls，执行工具并追加 tool result
  → 再次调用模型
  → 直到返回纯文本或达到最大轮次
```

例如用户输入：

```text
帮我看看为什么测试失败，并修复它
```

Agent 可能会这样执行：

```text
bash: pnpm test
read_file: test/core/agent.test.ts
read_file: src/core/agent.ts
edit_file: 修改 src/core/agent.ts
bash: pnpm test
```

最后再总结：

```text
已修复 xxx 问题，原因是 xxx，已通过 pnpm test。
```

这就是 Agent 和普通聊天机器人的区别：它不是只回答，而是会行动，并根据行动结果继续推理。

***

## 九、核心二：工具系统怎么设计？

工具系统是 Agent 的手和脚。

每个工具都实现统一接口：

```ts
interface Tool {
  name: string
  description: string
  parameters: JSONSchema
  requiresPermission: boolean
  execute(params: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>
}
```

这样有几个好处：

- 工具可以统一注册；
- 可以自动导出 function calling schema；
- 可以统一接入权限系统；
- 可以统一测试；
- 后续扩展新工具简单。

工具注册后，模型看到的是 JSON Schema，而不是 TypeScript 代码。

例如 `read_file` 可以描述为：

```json
{
  "name": "read_file",
  "description": "Read file contents with optional line range",
  "parameters": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string" },
      "offset": { "type": "number" },
      "limit": { "type": "number" }
    },
    "required": ["file_path"]
  }
}
```

模型根据这个 schema 决定什么时候调用工具、传什么参数。

***

## 十、核心三：权限系统不能省

做 AI Agent 最容易被忽视的是权限。

让 AI 直接操作本地文件和 shell，是有风险的。

所以 ds-code 的权限模型分三类：

### 1. 自动允许

只读工具自动执行：

- `read_file`
- `glob`
- `grep`
- `list_dir`

### 2. 需要确认

有副作用的工具需要用户确认：

- `write_file`
- `edit_file`
- `bash`

### 3. 直接拒绝

危险命令直接拒绝，例如：

```bash
rm -rf /
```

权限系统还支持：

- 本次允许；
- 始终允许同类工具；
- bash 命令白名单；
- 项目级 `.ds-code/settings.json` 持久化；
- 黑名单优先于白名单。

这个模块不是锦上添花，而是底线。

AI Agent 一旦具备行动能力，安全边界必须先设计。

***

## 十一、核心四：上下文和会话管理

真实使用时，对话会越来越长。

如果每一轮都把完整历史发给模型，会遇到几个问题：

- token 成本越来越高；
- 请求越来越慢；
- 超过模型上下文限制；
- 早期无关信息干扰当前任务。

因此 ds-code 做了上下文管理：

- 粗略估算 token；
- 超过阈值后自动压缩早期消息；
- 保留 system prompt 和最近消息；
- 支持 `/compact` 手动压缩。

同时，会话会保存到本地：

```text
~/.ds-code/sessions/
```

用户可以通过：

```bash
ds-code --resume
```

或：

```text
/resume
```

恢复最近会话。

这类能力决定了工具能不能支撑真实开发，而不是只能完成一次性问答。

***

## 十二、配置系统：不要只靠环境变量

一个真实 CLI 需要完整配置体系。

ds-code 的配置优先级是：

```text
CLI 参数 > 项目配置 > 全局配置 > 环境变量/默认值
```

配置文件位置：

```text
全局配置：~/.ds-code/config.json
项目配置：当前项目下 .ds-code/settings.json
```

配置示例：

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
    ],
    "allowAllCommands": false
  },
  "skills": {
    "enabled": true,
    "autoMatch": true,
    "autoMatchModel": true
  }
}
```

项目配置很有用，因为不同项目的安全策略、允许命令、模型选择可能不同。

***

## 十三、AI 最擅长什么？

这次开发下来，我觉得 Claude Code 在这些任务上非常强：

### 1. 从文档生成代码骨架

只要 PRD 和技术方案清楚，它能很快生成模块结构、接口定义和基础实现。

### 2. 实现边界明确的模块

例如：

- 配置加载；
- ToolRegistry；
- token 估算；
- 文件读写；
- SSE 解析；
- 命令行参数解析；
- session 存储。

### 3. 根据测试错误修复问题

把测试失败信息交给它，它通常能比较快定位问题。

### 4. 补测试

尤其是纯函数、工具类、权限规则、配置合并这类模块，AI 补测试效率很高。

### 5. 文档同步

README、架构文档、实现状态文档、测试说明这类内容，AI 很适合生成初稿和更新。

***

## 十四、实际体验中暴露的问题

功能做出来以后，真正的问题是在实际使用中暴露的。

### 1. 交互体验经常“不顺手”

这是最明显的问题。

AI 可以写出能运行的 Ink UI，但它不一定能做出舒服的终端体验。

比如：

- 输入状态切换不够自然；
- 工具调用状态展示太啰嗦或太隐晦；
- 权限确认提示不够清晰；
- 流式输出和最终消息之间可能重复；
- 多行输入边界不够符合直觉；
- `/` 补全的键盘交互体验太别扭；
- Ctrl+C 到底是中断请求还是退出，需要自己体验才知道。

这些问题不是测试能完全覆盖的，必须自己真实使用。

所以项目后期，我花了不少时间自己跑、自己试、自己调：

```text
启动 CLI
  → 输入普通问题
  → 输入多行内容
  → 触发工具调用
  → 拒绝权限
  → 允许权限
  → 中断请求
  → 切换模型
  → 恢复会话
  → 查看 status / doctor
```

只有真的用一遍，才知道哪里别扭。

### 2. Skills 触发一开始只做了本地匹配

另一个实际体验问题是 skills 自动触发。

一开始实现时，只做了本地规则匹配。比如用户说“补测试”“修 bug”“看下改动”，系统根据关键词判断要触发哪个 skill。

这个方案简单、便宜、响应快，但体验上有明显问题：

- 关键词没覆盖到时触发不了；
- 用户换一种说法就识别不到；
- 有些任务同时像 review、debug、test，本地规则不好判断；
- 误触发时用户会觉得被打断；
- 不触发时又退化成普通对话，失去了 skill 的价值。

后来我意识到，skills 的触发不能只靠本地匹配。更合理的方式是分两层：

```text
先用本地规则快速匹配
  → 匹配不到或置信度不够时
  → 再让模型判断是否应该触发某个 skill
  → 命中后给用户确认
```

这样既保留了本地匹配的速度，也能覆盖更多自然语言表达。

### 3. AI 容易低估安全边界

如果只说“实现 bash 工具”，AI 可能会直接执行命令。

但真实工具必须考虑：

- 哪些命令危险；
- 哪些命令需要确认；
- allowedCommands 是否能绕过黑名单；
- 用户选择 always allow 后如何持久化；
- 命令超时怎么处理；
- Ctrl+C 如何中断子进程。

这些必须由人明确要求。

### 4. AI 会倾向于“功能完成”，而不是“产品完成”

功能完成是：代码能跑。

产品完成是：用户知道怎么用，错误时知道怎么办，交互符合预期，文档和实现一致，边界条件有测试。

AI 经常能做到前者，但后者需要人持续验收。

***

## 十五、后期我主要手动调整了什么？

项目后期主要不是继续加大功能，而是调整体验。

我会重点看这些地方：

### 1. 首次启动体验

用户启动后应该立刻知道：

- 当前版本；
- 当前 provider / model；
- 是否配置了 API Key；
- 可以输入什么；
- 如何退出。

### 2. 流式输出体验

流式输出要做到：

- 有反馈，不要像卡住；
- 不重复展示；
- 工具调用和文本输出区分清楚；
- 错误提示不要淹没在大段文本里。

### 3. 权限确认体验

权限提示要让用户一眼看懂：

- AI 要做什么；
- 影响范围是什么；
- 可以本次允许还是永久允许；
- 拒绝后会发生什么。

### 4. Slash commands 体验

`/help`、`/status`、`/doctor` 这些命令不是核心智能能力，但它们决定了工具是否“可控”。不过 `/` 补全本身也需要打磨：候选项展示、上下键选择、Enter/Tab 确认、Esc 关闭，这些细节如果不顺，会非常影响终端使用体验。

AI Agent 越强，越需要确定性的控制入口。

### 5. 错误提示体验

比如 API Key 错误、网络失败、模型不支持 tools、JSON 解析失败、命令超时，这些都需要用户能看懂。

这类体验问题，AI 可以帮忙改，但前提是人要亲自发现问题并描述清楚。

***

## 十六、质量门禁：AI 写代码，更要跑检查

我在开发过程中始终依赖这些命令兜底：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

AI 写代码速度很快，但也可能很快把项目写坏。

所以每个模块都要尽量做到：

- 类型检查通过；
- lint 通过；
- 单元测试通过；
- 构建通过；
- 文档同步更新。

对 AI 编程来说，测试不只是质量保障，还是纠偏系统。

当 AI 改错了，测试会把它拉回来。

***

## 十七、几个特别有用的 prompt 模板

这次我觉得比较稳定的 prompt 不是“帮我实现 xxx”，而是带上下文、边界和验收标准的任务描述。

### 1. 生成 PRD

```text
我要做一个类似 Claude Code 的终端 AI 编程助手。
请先不要写代码，先输出 PRD。
包括：产品定位、目标用户、核心场景、MVP 范围、非目标范围、权限边界、配置方式、验收标准。
```

### 2. 生成技术方案

```text
基于 PRD 输出技术方案。
要求包含：技术选型、模块划分、目录结构、Agent 循环、工具系统、权限模型、上下文管理、会话管理、测试计划、风险应对。
```

### 3. 拆模块和测试

```text
把该项目拆成可独立实现的模块。
每个模块需要包含：编号、目标、涉及文件、依赖模块、完成标准、必须补充的测试。
```

### 4. 实现模块

```text
按 docs 中 Mxx 实现模块。
约束：不要改无关文件；保持现有接口兼容；补充 vitest 测试；完成后运行 pnpm typecheck 和 pnpm test。
```

### 5. 修复体验问题

```text
我实际使用时发现 xxx 体验不好。
期望行为是 xxx。
请先分析当前实现，再给出最小修改方案，然后修改代码并补充必要测试。
```

这个最后的 prompt 很重要。因为体验问题通常不是“bug”，而是“别扭”。你必须把自己的感受翻译成明确的期望行为。

***

## 十八、如果你也想用 vibecoding 做一个项目

我建议按这个节奏来：

### 第一步：先写 PRD

不要急着生成代码。先让 AI 明确产品是什么、不是什么。

### 第二步：写技术方案

让 AI 先设计模块、边界、数据流和测试策略。

### 第三步：拆模块

把大项目拆成一组可以独立验收的小模块。

### 第四步：生成项目 skills

把常见任务沉淀下来，比如：实现、测试、调试、重构、review、release。

### 第五步：按模块实现

每次只做一个明确模块，配套测试和质量检查。

### 第六步：真实使用

不要以为测试通过就结束。CLI、交互、提示、错误信息，都必须自己实际体验。

### 第七步：打磨体验

AI 可以帮你改体验，但“哪里不好用”通常要人自己发现。

***

## 十九、这次最大的收获

这次用 Claude Code 开发 ds-code，我最大的感受是：

> AI 编程不是跳过软件工程，而是把软件工程的重要性放大了。

以前一个人写代码，可能可以边想边写。

但和 AI 协作时，如果没有 PRD、技术方案、模块拆分、测试计划，AI 的速度反而会放大混乱。

相反，如果你先把边界定义清楚，AI 会变成一个非常高效的执行者：

- 它能快速搭骨架；
- 它能补大量样板代码；
- 它能实现清晰模块；
- 它能根据测试修 bug；
- 它能维护文档；
- 它能帮你做 review。

但这些仍然离不开人的判断：

- 产品边界要人定；
- 安全策略要人定；
- 交互体验要人试；
- 最终质量要人验收。

***

## 二十、结语

这次 vibecoding 实战，表面上是“用 Claude Code 开发了一个自己的 Claude Code”。

但更本质的收获是：我找到了一套更适合 AI 协作的开发流程：

```text
PRD → 技术方案 → 模块拆分 → 项目 skills → 模块开发 → 测试验证 → 体验打磨
```

这套流程让我明显感觉到，AI 不是一个简单的代码生成器，而是一个可以参与产品设计、架构拆解、编码实现、测试补齐和文档维护的协作者。

不过，最后一公里仍然属于人。

尤其是交互体验。

AI 可以把功能做出来，但好不好用，还是要自己打开终端，一遍遍试，一遍遍改。

所以我现在对 vibecoding 的理解是：

> 让 AI 加速从想法到可运行版本的过程，让工程化保证它不跑偏，让人负责最终的产品判断。

如果你也想尝试，不妨从一个小项目开始。

先让 AI 写 PRD。

再让它写技术方案。

再拆模块。

再生成 skills。

再开始写代码。

你会发现，AI 编程真正改变的不是某几行代码怎么写，而是整个开发流程。
