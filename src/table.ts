import { LUA_REGISTRYINDEX, LuaType } from './definitions';
import LuaThread from './thread';
import { DictType, mapTransform } from './utils/map-transform';

export class LuaTable {
    private thread: LuaThread;
    private ref: number;
    private pointer: number;

    [key: string]: any;
    [key: symbol]: any;

    public constructor(thread: LuaThread, ref: number, pointer: number) {
        this.thread = thread;
        this.ref = ref;
        this.pointer = pointer;
    }

    private getTableValue(key: any): any {
        this.thread.luaApi.lua_rawgeti(this.thread.address, LUA_REGISTRYINDEX, this.ref);
        this.thread.pushValue(key);
        this.thread.luaApi.lua_gettable(this.thread.address, -2);
        const result = this.thread.getValue(-1);
        this.thread.pop();
        return result;
    }

    private setTableValue(key: any, value: any): boolean {
        this.thread.luaApi.lua_rawgeti(this.thread.address, LUA_REGISTRYINDEX, this.ref);
        this.thread.pushValue(key);
        key = this.thread.getValue(-1);
        this.thread.pushValue(value);
        value = this.thread.getValue(-1);
        this.thread.luaApi.lua_settable(this.thread.address, -3);
        this.thread.pop(1);
        return true;
    }

    private detachTable(index: number, refs?: Map<number, any>): Map<any, any> {
        index = this.thread.luaApi.lua_absindex(this.thread.address, index);
        if (!refs) refs = new Map();
        const pointer = this.thread.luaApi.lua_topointer(this.thread.address, index);
        if (refs.has(pointer)) return refs.get(pointer);
        const result = new Map();
        refs.set(pointer, result);

        this.thread.luaApi.lua_pushnil(this.thread.address);
        while (this.thread.luaApi.lua_next(this.thread.address, index) !== 0) {
            const key = this.thread.getType(-2) === LuaType.Table ? this.detachTable(-2, refs) : this.thread.getValue(-2);
            const value = this.thread.getType(-1) === LuaType.Table ? this.detachTable(-1, refs) : this.thread.getValue(-1);
            result.set(key, value);
            this.thread.pop();
        }
        return result;
    }

    public $get(key: any): any {
        return this.getTableValue(key);
    }

    public $set(key: any, value: any): boolean {
        return this.setTableValue(key, value);
    }

    public $istable(): true {
        return true;
    }

    public $getRef(): number {
        return this.ref;
    }

    public $detach(dictType?: DictType): Map<any, any> {
        this.thread.luaApi.lua_rawgeti(this.thread.address, LUA_REGISTRYINDEX, this.ref);
        let map = this.detachTable(-1);
        this.thread.pop();
        map = mapTransform(map, { dictType: dictType ?? DictType.Map }) as Map<any, any>;
        return map;
    }

    public toString(): string {
        return `[LuaTable *${this.ref} 0x${this.pointer.toString(16)}]`;
    }
}

export const getTable = (thread: LuaThread, index: number): LuaTable => {
    // 根据内存地址，判断是否已经get过，如果有直接从引用表中返回
    let pointer = thread.luaApi.lua_topointer(thread.address, index);
    if (thread.luaApi.pointerRefs.has(pointer)) {
        return thread.luaApi.pointerRefs.get(pointer).proxy;
    }

    // 在lua中创建一个引用
    const ref = thread.luaApi.luaL_ref(thread.address, LUA_REGISTRYINDEX);
    thread.luaApi.lua_rawgeti(thread.address, LUA_REGISTRYINDEX, ref);

    const table = new LuaTable(thread, ref, pointer);
    const { proxy, revoke } = Proxy.revocable(table, {
        get: (target, key) => {
            if (target[key]) return target[key];
            if (key === Symbol.toStringTag) return () => 'LuaTable';
            if (typeof key === 'symbol') return undefined;
            return target.$get(key);
        },
        set: (target, key, value) => target.$set(key, value),
    });

    thread.luaApi.pointerRefs.set(pointer, { proxy, revoke });
    return proxy;
};
