// 打包 ESM、CommonJS 和各自的完整类型声明，WASM 作为外部资源随包发布。
import { defineConfig } from 'tsdown';
import { builtinModules } from 'node:module';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    platform: 'neutral',
    deps: { neverBundle: [...builtinModules, /^node:/] },
    target: 'es2022',
    dts: true,
    shims: true,
    copy: [{ from: 'build/liblua5.1.wasm', to: 'dist' }],
    outExtensions: ({ format }) => ({ js: format === 'es' ? '.mjs' : '.js', dts: format === 'es' ? '.d.mts' : '.d.ts' }),
});
