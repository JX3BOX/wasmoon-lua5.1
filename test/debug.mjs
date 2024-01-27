import { Lua } from '../dist/index.js';

// This file was created as a sandbox to test and debug on vscode
const lua = await Lua.create();
await lua.doString(`print('Hello World!')`);
