// 提供 Lua 全局环境的 JS 属性访问代理。
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
        has: (target: LuaGlobal, key: string) => {
            return target.get(key) !== undefined;
        },
    });
};

export default getContextProxy;
