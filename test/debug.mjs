import { LUA_REGISTRYINDEX, Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

const value = lua
    .doStringSync(
        `
        local obj1 = {
            hello = 'world',
        }
        obj1.self = obj1
        local obj2 = {
            5,
            hello = 'everybody',
            array = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
            fn = function()
                return 'hello'
            end
        }
        obj2.self = obj2
        return { obj1 = obj1, obj2, name = 123 }
    `,
    )
    .$detach({ dictType: 1 });

const obj = [, [, 5]];
obj[1]['hello'] = 'everybody';
obj[1]['array'] = [, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
obj[1]['fn'] = value[1]['fn'];
obj['obj1'] = {
    hello: 'world',
};
obj['obj1'].self = obj['obj1'];
obj[1].self = obj[1];
