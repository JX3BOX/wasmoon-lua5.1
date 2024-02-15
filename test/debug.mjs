import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

lua.ctx.a = { name: 'a' };
lua.ctx.a.b = { name: 'b' };
lua.ctx.a.b.c = { name: 'c' };
lua.ctx.a.b.c.d = { name: 'd' };

lua.global.dumpStack();
console.log(lua.global.getValue(-1).$detach());
