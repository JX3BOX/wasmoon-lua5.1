import { Decoration } from '../decoration'
import { LuaReturn, LuaState } from '../types'
import Global from '../global'
import Thread from '../thread'
import TypeExtension from '../type-extension'

class NullTypeExtension extends TypeExtension<unknown> {
    private gcPointer: number

    public constructor(thread: Global) {
        super(thread, 'js_null')

        this.gcPointer = thread.luaApi.module.addFunction((functionStateAddress: LuaState) => {
            // Throws a lua error which does a jump if it does not match.
            const userDataPointer = thread.luaApi.luaL_checkudata(functionStateAddress, 1, this.name)
            const referencePointer = thread.luaApi.module.getValue(userDataPointer, '*')
            thread.luaApi.unref(referencePointer)

            return LuaReturn.Ok
        }, 'ii')

        if (thread.luaApi.luaL_newmetatable(thread.address, this.name)) {
            const metatableIndex = thread.luaApi.lua_gettop(thread.address)

            // Mark it as uneditable
            thread.luaApi.lua_pushstring(thread.address, 'protected metatable')
            thread.luaApi.lua_setfield(thread.address, metatableIndex, '__metatable')

            // Add the gc function
            thread.luaApi.lua_pushcclosure(thread.address, this.gcPointer, 0)
            thread.luaApi.lua_setfield(thread.address, metatableIndex, '__gc')

            // Add an __index method that returns nothing.
            thread.pushValue(() => null)
            thread.luaApi.lua_setfield(thread.address, metatableIndex, '__index')

            thread.pushValue(() => 'null')
            thread.luaApi.lua_setfield(thread.address, metatableIndex, '__tostring')

            thread.pushValue((self: unknown, other: unknown) => self === other)
            thread.luaApi.lua_setfield(thread.address, metatableIndex, '__eq')
        }
        // Pop the metatable from the stack.
        thread.luaApi.lua_pop(thread.address, 1)

        // Create a new table, this is unique and will be the "null" value by attaching the
        // metatable created above. The first argument is the target, the second options.
        super.pushValue(thread, new Decoration<unknown>({}, {}))
        // Put it into the global field named null.
        thread.luaApi.lua_setglobal(thread.address, 'null')
    }

    public getValue(thread: Thread, index: number): null {
        const refUserData = thread.luaApi.luaL_checkudata(thread.address, index, this.name)
        if (!refUserData) {
            throw new Error(`data does not have the expected metatable: ${this.name}`)
        }
        return null
    }

    // any because LuaDecoration is not exported from the Lua lib.
    public pushValue(thread: Thread, decoration: any): boolean {
        if (decoration?.target !== null) {
            return false
        }
        // Rather than pushing a new value, get the global "null" onto the stack.
        thread.luaApi.lua_getglobal(thread.address, 'null')
        return true
    }

    public close(): void {
        this.thread.luaApi.module.removeFunction(this.gcPointer)
    }
}

export default function createTypeExtension(thread: Global): TypeExtension<null> {
    return new NullTypeExtension(thread)
}
