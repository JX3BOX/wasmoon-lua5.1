import { Lua } from '../dist/index.js';

// This file was created as a sandbox to test and debug on vscode
const lua = await Lua.create();

lua.global.loadString(`
    local i = 0
    while true do i = i + 1 end
`);

await lua.global.run(0, { timeout: 5 }).catch((e) => console.log(e));
