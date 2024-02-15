import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

// const lua = await Lua.create();

// function test() {
//     return 1234;
// }

// for (const index of Array.from({ length: 1 }, (_, i) => i + 1)) {
//     console.log(index);
//     lua.ctx.test = test;
//     for (const i of Array.from({ length: 50 }, (_, i) => i + 1)) {
//         await lua.doString('test()');
//         await lua.doString(`print(test.x)`);
//         await lua.doString(`test.x = ${i}`);
//     }
// }

class TestClass {
    static hello() {
        return 'world';
    }

    constructor(name) {
        this.name = name;
    }

    getName() {
        return this.name;
    }

    toString() {
        return `TestClass<${this.name}>`;
    }
}

const lua = await Lua.create();

lua.ctx.TestClass = {
    create: (name) => new TestClass(name),
};
const res = await lua.doString(`
    local instance = TestClass.create("demo name 2")
    return instance.getName()
`);
console.log(res);
