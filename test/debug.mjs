import { Lua } from '../dist/index.js';

// This file was created as a sandbox to test and debug on vscode
const lua = await Lua.create();
lua.ctx.t = { test: 1 };
lua.ctx.test = () => {
    return lua.ctx.t;
};
const value = await lua.doString('return test(2)');
console.log(value);
// await lua.doString('print(getmetatable(p))');
// await lua.doString('print(getmetatable(p).__index)');
// await lua.doString('print(getmetatable(p).__index(x))');
// await lua.doString('print(p.x)');
// lua.ctx.test = () => {
//     return {
//         aaaa: 1,
//         bbb: 'hey',
//         test() {
//             return 22;
//         },
//     };
// };

// await lua.doString('print(test)');
// await lua.doString('print(test())');
// await lua.doString('print(test().test())');
