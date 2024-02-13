import { LUA_REGISTRYINDEX, Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

const obj = {};
lua.ctx.obj = obj;

const o = lua.ctx.obj;
o.name = 114514;
console.log(o.name);

lua.doStringSync(`
    print(obj.name)
`);
