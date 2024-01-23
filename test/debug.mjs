import { JsType, Lua } from '../dist/index.js';

// This file was created as a sandbox to test and debug on vscode
const lua = await Lua.create();

lua.ctx.null = JsType.decorate(null).tostring(() => 'null');

lua.global.loadString(`
    local args = { ... }
    assert(args[1] == null, string.format("expected first argument to be null, got %s", tostring(args[1])))
    return null, args[1], tostring(null)
`);
lua.global.pushValue(null);
const res = await lua.global.run(1);
expect(res).to.deep.equal([null, null, 'null']);
