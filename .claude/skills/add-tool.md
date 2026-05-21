# 添加工具

为 ds-code 添加一个新的工具（Tool）。

## 使用方式

`/add-tool <工具名称>` 并描述工具的功能

## 执行步骤

1. 读取 src/tools/types.ts 了解 Tool 接口定义
2. 读取 src/tools/registry.ts 了解注册方式
3. 参考已有工具实现（如 src/tools/read.ts）了解代码风格
4. 在 src/tools/ 下创建新工具文件
5. 实现 Tool 接口：name、description、parameters（JSON Schema）、execute
6. 在 registry 中注册该工具
7. 编写对应测试文件 test/tools/<工具名>.test.ts
8. 运行 `pnpm build` 和 `pnpm test` 确认通过
9. 更新 docs/MODULES_AND_TESTS.md 中的工具列表

## 约束

- parameters 使用 JSON Schema 格式，与 OpenAI function calling 兼容
- 危险操作（写入、删除、执行）必须设置 requiresPermission: true
- execute 方法返回 ToolResult，包含 content 和 isError 字段
- 错误不要抛异常，而是返回 isError: true 的 ToolResult
