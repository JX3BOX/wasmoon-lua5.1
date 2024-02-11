import { LUA_REGISTRYINDEX } from './definitions';
import LuaThread from './thread';

export const getTableProxy = (table: { map: Map<any, any>; ref: number }, thread: LuaThread): LuaTable => {
    const setTable = (key: any, value: any) => {
        const ref = table.ref;
        thread.luaApi.lua_rawgeti(thread.address, LUA_REGISTRYINDEX, ref);
        thread.pushValue(key);
        key = thread.getValue(-1);
        thread.pushValue(value);
        value = thread.getValue(-1);
        thread.luaApi.lua_settable(thread.address, -3);
        table.map.set(key, value);
        return true;
    };

    const proxy = new Proxy(table, {
        get: (target, prop) => {
            // 设置值
            if (prop === '$set') {
                return (key: any, value: any) => setTable(key, value);
            }
            // 获取table
            if (prop === '$get') {
                return (key: any) => {
                    target.map.get(key);
                };
            }
            // TODO: 解除与lua的绑定(包括内层)，返回一个Map
            if (prop === '$detach') {
            }
            // 迭代器
            if (prop === Symbol.iterator) {
                return function* () {
                    for (const [key, value] of target.map.entries()) {
                        yield [key, value];
                    }
                };
            }
            return target.map.get(prop);
        },
        set: (_, prop, value) => {
            return setTable(prop, value);
        },
    });
    return proxy as LuaTable;
};
