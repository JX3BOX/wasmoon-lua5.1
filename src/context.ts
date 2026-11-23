// 提供 Lua 全局环境的 JS 属性访问代理。
import { LuaType } from './definitions';
import LuaGlobal from './global';
import type { LuaContext } from './types';

const getContextProxy = (global: LuaGlobal): LuaContext => {
    return new Proxy(global, {
        get: (target: LuaGlobal, key) => {
            // TODO: implement iterator for all global variables
            if (key === Symbol.iterator) {
                return {
                    next: () => {
                        return 1;
                    },
                };
            }
            if (typeof key === 'symbol') {
                return undefined;
            }
            return target.get(key);
        },
        set: (target: LuaGlobal, key: string, value: any) => {
            target.set(key, value);
            return true;
        },
        has: (target: LuaGlobal, key: string | symbol) => {
            if (typeof key === 'symbol') {
                return false;
            }
            const type = target.luaApi.lua_getglobal(target.address, key);
            target.pop();
            return type !== LuaType.Nil && type !== LuaType.None;
        },
    });
};

export default getContextProxy;
