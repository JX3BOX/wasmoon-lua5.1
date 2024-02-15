import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

lua.ctx.s = {
    name: 123,
};

lua.ctx.s.a = {};
lua.ctx.s.a.b = {};
lua.ctx.s.a.b.c = {};
lua.ctx.s.a.b.c.name = '233';

console.log(lua.ctx.s.a.b.c);
await lua.doString(`
    print(s.a.b.c)
    print(s.a.b.c.name)
`);
