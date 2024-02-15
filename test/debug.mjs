import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

function test() {
    return 1234;
}

for (const index of Array.from({ length: 1 }, (_, i) => i + 1)) {
    console.log(index);
    lua.ctx.test = test;
    for (const i of Array.from({ length: 50 }, (_, i) => i + 1)) {
        await lua.doString('test()');
        await lua.doString(`print(test.x)`);
        await lua.doString(`test.x = ${i}`);
    }
}
