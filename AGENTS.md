# wasmoon-lua5.1

本仓库提供 Lua 5.1 WASM 与 JS/TypeScript 绑定。优先修复真实调用方、构建或测试能复现的问题；不要把整理扩展为未验证的 VM 全面重写。保留用户修改，未经明确要求不提交、推送或触发发布。

- 使用 tsdown 生成 CommonJS、ESM 与各自声明。公开类型通过 `src/types.ts` 和入口导出，不恢复全局声明、`declare module '*.js'` 或回指仓库源码的声明路径。
- 修改 Emscripten 参数后，应重新编译 WASM 验证，不能用旧二进制的通过结果证明新构建参数可用。工具版本与命令见 README。
- 涉及打包、导出或声明时运行 `npm run test:package`，验证实际 tarball 的运行和严格类型检查。
- 修改 npm CLI 交互或发布验收时，必须使用工作流固定的 npm 版本验证；本机不同版本的通过结果不能代替 CI 版本验证。
- npm Trusted Publisher 绑定 `.github/workflows/publish.yml`，不要随意改文件名。main 推送通过检查后使用 OIDC 执行 `npm publish`
- 新增或修改的源码文件用简短中文文件头说明职责；遵循现有 Prettier/ESLint 风格，仅格式化涉及文件。
