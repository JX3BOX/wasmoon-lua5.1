import { BaseDecorationOptions, Decoration } from '../decoration'
import { LuaReturn, LuaState, LuaType } from '../types'
import Global from '../global'
import Thread from '../thread'
import TypeExtension from '../type-extension'

export interface UserdataDecorationOptions extends BaseDecorationOptions {
    reference?: boolean
}

export function decorateUserdata(target: unknown): Decoration<any, UserdataDecorationOptions> {
    return new Decoration<any, UserdataDecorationOptions>(target, { reference: true })
}

class UserdataTypeExtension extends TypeExtension<any, UserdataDecorationOptions> {
    private readonly gcPointer: number

    public constructor(thread: Global) {
        super(thread, 'js_userdata')

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
        }

        // Pop the metatable from the stack.
        thread.luaApi.lua_pop(thread.address, 1)
    }

    public isType(_thread: Thread, _index: number, type: LuaType, name?: string): boolean {
        return type === LuaType.Userdata && name === this.name
    }

    public getValue(thread: Thread, index: number): any {
        const refUserdata = thread.luaApi.lua_touserdata(thread.address, index)
        const referencePointer = thread.luaApi.module.getValue(refUserdata, '*')
        return thread.luaApi.getRef(referencePointer)
    }

    public pushValue(thread: Thread, decoratedValue: Decoration<any, UserdataDecorationOptions>): boolean {
        if (!decoratedValue.options.reference) {
            return false
        }

        return super.pushValue(thread, decoratedValue)
    }

    public close(): void {
        this.thread.luaApi.module.removeFunction(this.gcPointer)
    }
}

export default function createTypeExtension(thread: Global): TypeExtension<Error> {
    return new UserdataTypeExtension(thread)
}
