import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

class Test {
    hello() {
        return 1234;
    }
}

for (const index of Array.from({ length: 20 }, (_, i) => i + 1)) {
    console.log(index);
    const test = new Test();
    lua.ctx.test = test;
    for (const i of Array.from({ length: 50 }, (_, i) => i + 1)) {
        await lua.doString('test:hello()');
    }
    console.log('ref ', lua.luaApi.referenceMap);
}
