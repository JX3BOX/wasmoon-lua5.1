import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

await lua.doString(`
function Apply() 
    function Apply() 
        print(123)
    end
end
`);

console.log(lua.global.getGlobalPointer('Apply'));
await lua.doString(`Apply()`);
console.log(lua.global.getGlobalPointer('Apply'));
await lua.doString(`Apply()`);
console.log(lua.global.getGlobalPointer('Apply'));
await lua.doString(`Apply()`);
