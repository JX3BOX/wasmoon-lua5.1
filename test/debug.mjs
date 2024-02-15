import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

lua.ctx.s = {
    name: 123,
};

for (const index of Array.from({ length: 10 }, (_, i) => i + 1)) {
    console.log(index);
    lua.ctx.s = {
        name: 123,
    };
    const table = lua.ctx.s;
    console.log(table);
    table.$destroy();
    console.log(table);
}
