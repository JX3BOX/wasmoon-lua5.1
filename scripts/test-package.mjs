// 安装实际 npm tarball，验证两种模块入口、WASM 文件与不依赖仓库的类型声明。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'wasmoon-package-'));
const npm = (...args) => execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: directory, encoding: 'utf8' });
try {
    // npm 12 按包名返回对象，npm 11 返回数组；本命令只打包当前包，统一读取其值。
    const [packed] = Object.values(
        JSON.parse(
            execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--pack-destination', directory], {
                cwd: root,
                encoding: 'utf8',
            }),
        ),
    );
    assert(packed.files.some((file) => file.path === 'dist/liblua5.1.wasm'));
    assert(!packed.files.some((file) => file.path.startsWith('types/') || file.path.startsWith('src/')));
    writeFileSync(join(directory, 'package.json'), '{"private":true}');
    npm('install', '--ignore-scripts', '--no-audit', '--no-fund', join(directory, packed.filename));
    const body = `
        const lua = await Lua.create();
        try {
            lua.bindAsync('fetchValue', () => Promise.resolve(41));
            lua.mountFile('/test.lua', 'return fetchValue() + 1');
            if (await lua.doFile('/test.lua') !== 42) throw new Error('invalid async file result');
        } finally { lua.global.close(); }
    `;
    writeFileSync(
        join(directory, 'consumer.cjs'),
        `const {Lua}=require('wasmoon-lua5.1'); (async()=>{${body}})().catch(e=>{console.error(e);process.exitCode=1});`,
    );
    writeFileSync(join(directory, 'consumer.mjs'), `import {Lua} from 'wasmoon-lua5.1'; ${body}`);
    for (const name of ['consumer.cjs', 'consumer.mjs']) execFileSync(process.execPath, [name], { cwd: directory, stdio: 'inherit' });
    const cli = join(directory, 'node_modules/wasmoon-lua5.1/bin/wasmoon');
    const runCli = (args, input = '') => execFileSync(process.execPath, [cli, ...args], { cwd: directory, input, encoding: 'utf8' }).trim();
    assert.equal(runCli([], 'return 42'), '42');
    writeFileSync(join(directory, 'input.lua'), 'return 43');
    assert.equal(runCli(['input.lua']), '43');
    assert.equal(runCli(['-l', 'input.lua'], `return dofile("${join(directory, 'input.lua').replaceAll('\\', '/')}")`), '43');
    const source = `
        import {Lua, DictType, type LuaCreateOptions, type LuaTable} from 'wasmoon-lua5.1';
        const options: LuaCreateOptions = {openStandardLibs: true};
        async function main() {
            const lua = await Lua.create(options);
            lua.bindAsync('read', async (name: string) => name.length);
            const table: LuaTable = lua.global.getTable(-1);
            const map: Map<unknown, unknown> = table.$detach();
            const object: Record<string, unknown> = table.$detach(DictType.Object);
            const array: unknown[] = table.$detach(DictType.Array);
            return [map, object, array];
        }
        void main;
    `;
    for (const extension of ['cts', 'mts']) writeFileSync(join(directory, `consumer.${extension}`), source);
    writeFileSync(
        join(directory, 'globals.ts'),
        `// @ts-expect-error Package types must not pollute the global namespace.\nconst options: LuaCreateOptions = {};\n`,
    );
    writeFileSync(
        join(directory, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                target: 'ES2022',
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                strict: true,
                skipLibCheck: false,
                noEmit: true,
                types: [],
                lib: ['ES2022'],
            },
            files: ['consumer.cts', 'consumer.mts', 'globals.ts'],
        }),
    );
    execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(directory, 'tsconfig.json')], {
        stdio: 'inherit',
    });
    for (const name of ['index.d.ts', 'index.d.mts']) {
        assert(
            !/reference path|declare global|\.\.\/src\//.test(
                readFileSync(join(directory, 'node_modules/wasmoon-lua5.1/dist', name), 'utf8'),
            ),
        );
    }
    console.log('Packed CJS, ESM, async WASM and strict consumer types passed.');
} finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
}
