import { JsType, Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

class S {
    pp() {
        console.log('pp');
    }
}
const s = new S();

lua.ctx.s = JsType.decorate(s)
    .tostring(() => '2333')
    .index((target, key) => target[key])
    .newindex((target, key, value) => {
        target[key] = value;
    });

await lua.doString(`
    print(s) 
`);
