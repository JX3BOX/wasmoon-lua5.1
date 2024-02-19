import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

await lua.doString(`
    x = function ()
    print(1)
 return 1
 end
 z = function ()
    print(1)
 return 1
 end
 `);

const x = lua.ctx.x;
const y = lua.ctx.z;
console.log(x === y);
lua.global.dumpStack();
console.log('===========');
console.log(x());
lua.global.dumpStack();
console.log('===========');
console.log(x());
lua.global.dumpStack();
console.log('===========');
console.log(x());
lua.global.dumpStack();
