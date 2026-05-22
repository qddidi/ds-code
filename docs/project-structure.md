# 项目结构

```text
ds-code/
├── bin/
│   └── ds-code.tsx
├── src/
│   ├── api/
│   │   ├── deepseek.ts
│   │   ├── index.ts
│   │   ├── retry.ts
│   │   ├── stream.ts
│   │   └── types.ts
│   ├── cli/
│   │   ├── app.tsx
│   │   ├── commands.ts
│   │   ├── input.ts
│   │   ├── model.ts
│   │   ├── options.ts
│   │   ├── output.ts
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
    ├── api/
    ├── cli/
    ├── config/
    ├── core/
    ├── integration/
    ├── permissions/
    ├── tools/
    └── utils/
```
