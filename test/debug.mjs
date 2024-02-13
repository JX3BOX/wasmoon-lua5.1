import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();
await lua.doString(
    `local function a()
error("function a threw error")
end
local function b() a() end
local function c() b() end
c()`,
);
