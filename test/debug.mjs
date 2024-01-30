import { Lua } from '../dist/index.js';
import fs from 'fs';

// This file was created as a sandbox to test and debug on vscode
const std = '/home/x3zvawq/workspace/JX3BOX/jx3-raw/unpack/std/scripts/include/CustomFunction.lua';
const origin = '/home/x3zvawq/workspace/JX3BOX/jx3-raw/unpack/origin/scripts/include/CustomFunction.lua';

const std_buffer = new Uint8Array(fs.readFileSync(std).buffer);
const origin_buffer = new Uint8Array(fs.readFileSync(origin).buffer);

const lua = await Lua.create();
lua.mountFile('/std', std_buffer);
lua.mountFile('/origin', origin_buffer);

await lua.doString(`
    function expose_locals()
        local i = 1
        while true do
            local name, value = debug.getlocal(2, i)
            print(name, value)
            if not name then break end
            -- 将local变量设置为全局变量
            _G[name] = value
            i = i + 1
        end
    end
`);
await lua.doString(`
    local x = 1
    expose_locals()
`);
await lua.doString(`expose_locals()`);
await lua.doString('print(x)');
