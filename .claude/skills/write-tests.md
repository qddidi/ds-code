# 编写测试

为指定模块编写测试用例。

## 使用方式

`/write-tests <模块编号>`，例如 `/write-tests M07`

## 执行步骤

1. 读取 MODULES_AND_TESTS.md，找到对应模块的测试表
2. 检查模块源码是否已实现（读取对应文件）
3. 在 test/ 目录下创建对应测试文件（如 test/tools/read.test.ts）
4. 按照测试表逐条实现测试用例，使用 vitest
5. 对需要文件系统的测试，使用临时目录（vitest 的 beforeEach/afterEach）
6. 对需要 mock API 的测试，使用 vitest 的 vi.mock
7. 运行 `pnpm test <测试文件>` 确认全部通过
8. 汇报测试覆盖情况

## 约束

- 测试文件命名：`test/<模块路径>/<文件名>.test.ts`
- 每个测试用例对应测试表中的一行
- 使用 describe/it 组织，describe 为模块名，it 为测试项名称
- 不使用 snapshot 测试
- mock 尽量最小化，优先用真实文件系统（临时目录）
