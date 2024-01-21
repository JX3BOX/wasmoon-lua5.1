import { Lua } from '../dist/index.js';

// This file was created as a sandbox to test and debug on vscode
const lua = await Lua.create();

lua.ctx.test = () => {
    return {
        aaaa: 1,
        bbb: 'hey',
        test() {
            return 22;
        },
    };
};

await lua.doString('print(test)');
await lua.doString('print(test())');
await lua.doString('print(test().test())');
