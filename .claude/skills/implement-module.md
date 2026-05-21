# 实现模块

根据 docs/MODULES_AND_TESTS.md 中的模块定义，实现指定模块的代码。

## 使用方式

`/implement-module <模块编号>`，例如 `/implement-module M02`

## 执行步骤

1. 读取 docs/MODULES_AND_TESTS.md，找到对应模块的「范围」和「完成标准」
2. 读取 docs/TECHNICAL_PLAN.md 中相关的架构设计
3. 检查该模块的依赖模块是否已实现（检查对应文件是否存在）
4. 按照项目现有代码风格实现模块代码
5. 实现完成后运行 `pnpm build` 确认编译通过
6. 运行该模块的测试 `pnpm test -- --grep <模块名>`
7. 汇报完成状态和遗留问题

## 约束

- 遵循项目已有的代码风格和命名规范
- 不引入模块范围外的额外依赖
- 每个文件头部不加多余注释
- 导出接口要与 docs/TECHNICAL_PLAN.md 中定义的一致
- 每次测试完成后，确认测试通过，直接提交代码
