import { LuaFactory } from '../src'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
;(async () => {
    const fac = new LuaFactory()
    const engine = await fac.createEngine({ traceAllocations: false })
    engine.global.set('x1', 1)
    console.log('save success')
    console.log(engine.global.get('x1'))

    engine.global.set('x2', true)
    console.log('save success')
    console.log(engine.global.get('x2'))

    engine.global.set('x3', null)
    console.log('save success')
    console.log(engine.global.get('x3'))

    engine.global.set('x4', { tt: 2 })
    console.log('save success')
    console.log(engine.global.get('x4'))

    engine.global.set('x5', (x: number) => x + 6)
    console.log('save success')
    console.log(engine.global.get('x5'))
})()

// eslint-disable-next-line @typescript-eslint/no-floating-promises
// ;(async () => {
//     const lua = await LuaApi.initialize()
//     const L = lua.luaL_newstate()
//     console.log(L)
//     lua.module.ccall('lua_pushfstring', 'number', ['number', 'array'], [L, ['%s', '14515']])
//     const string = lua.lua_tostring(L, -1)
//     console.log(string)
// })()
