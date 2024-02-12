import { LUA_REGISTRYINDEX, LuaType } from './definitions';
import LuaThread from './thread';
import { mapTransform } from './utils/map-transform';

export const getTable = (thread: LuaThread, index: number): LuaTable => {
    // 根据内存地址，判断是否已经get过，如果有直接从引用表中返回
    let pointer = thread.luaApi.lua_topointer(thread.address, index);
    if (thread.luaApi.pointerRefs.has(pointer)) {
        return thread.luaApi.pointerRefs.get(pointer).proxy;
    }

    // 在lua中创建一个引用
    const ref = thread.luaApi.luaL_ref(thread.address, LUA_REGISTRYINDEX);

    const getTableValue = (key: any) => {
        thread.luaApi.lua_rawgeti(thread.address, LUA_REGISTRYINDEX, ref);
        thread.luaApi.lua_getfield(thread.address, -1, key);
        const result = thread.getValue(-1);
        thread.pop();
        return result;
    };

    const setTableValue = (key: any, value: any) => {
        thread.luaApi.lua_rawgeti(thread.address, LUA_REGISTRYINDEX, ref);
        thread.pushValue(key);
        key = thread.getValue(-1);
        thread.pushValue(value);
        value = thread.getValue(-1);
        thread.luaApi.lua_settable(thread.address, -3);
        thread.pop(1);
        return true;
    };

    const detachTable = (index: number, refs?: Map<number, any>) => {
        index = thread.luaApi.lua_absindex(thread.address, index);
        if (!refs) refs = new Map();
        const pointer = thread.luaApi.lua_topointer(thread.address, index);
        if (refs.has(pointer)) return refs.get(pointer);
        const result = new Map();
        refs.set(pointer, result);

        thread.luaApi.lua_pushnil(thread.address);
        while (thread.luaApi.lua_next(thread.address, index) !== 0) {
            const key = thread.getType(-2) === LuaType.Table ? detachTable(-2, refs) : thread.getValue(-2);
            const value = thread.getType(-1) === LuaType.Table ? detachTable(-1, refs) : thread.getValue(-1);
            result.set(key, value);
            thread.pop();
        }
        return result;
    };

    const { proxy, revoke } = Proxy.revocable(
        {},
        {
            get: (_, key) => {
                if (key === '$get') return (key: any) => getTableValue(key);
                if (key === '$set') return (key: any, value: any) => setTableValue(key, value);
                if (key === '$istable') return () => true;
                if (key === '$getRef') return () => ref;
                if (key === '$detach') {
                    return (options: LuaTableDetachOptions) => {
                        thread.luaApi.lua_rawgeti(thread.address, LUA_REGISTRYINDEX, ref);
                        let map = detachTable(-1);
                        thread.pop();
                        map = mapTransform(map, options) as Map<any, any>;
                        return map;
                    };
                }
                return getTableValue(key);
            },
            set: (_, key, value) => setTableValue(key, value),
        },
    );
    thread.luaApi.pointerRefs.set(pointer, { proxy, revoke });

    return proxy as LuaTable;
};
