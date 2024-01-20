import { Lua } from '../src';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    const lua = await Lua.create();

    const ctx = lua.ctx;
    ctx.f = () => 11;

    await lua.doString(`print(f())`);
    console.log(ctx.f());
})();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
// ;(async () => {
//     const lua = await LuaApi.initialize()
//     const L = lua.luaL_newstate()
//     console.log(L)
//     lua.module.ccall('lua_pushfstring', 'number', ['number', 'array'], [L, ['%s', '14515']])
//     const string = lua.lua_tostring(L, -1)
//     console.log(string)
// })()
