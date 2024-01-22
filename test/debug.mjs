import { Lua } from '../dist/index.js';

// This file was created as a sandbox to test and debug on vscode
const lua = await Lua.create();

const a = { name: 'a' };
const b = { name: 'b' };
b.a = a;
a.b = b;

lua.global.pushValue(a);
// lua.global.luaApi.lua_setglobal(lua.global.address, 'x');
// lua.doStringSync(`
//     print(x.b.a.b.a)
// `);
const res = lua.global.getValue(-1);

//console.log(res.b.a);
console.log(res);
