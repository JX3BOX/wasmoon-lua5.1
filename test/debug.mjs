import { LUA_REGISTRYINDEX, Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();
await lua.doString(`
    x = {}
`);

const x = lua.ctx.x;
x.a = 2;
x.$set('b', 3);

console.log(x);
await lua.doString(`
    print(x.a)
    print(x.b)
`);
