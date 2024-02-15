import { LuaReturn, LuaType } from './definitions';
import LuaApi from './api';
import LuaThread from './thread';

export class FuncManager {
    public readonly luaApi: LuaApi;
    public readonly pointerRedirect: Map<number, number> = new Map();
    public readonly indexMap: Map<number, any> = new Map();

    // 单例
    private gc: number = 0;
    private call: number = 0;
    private func_call: number = 0;
    private index: number = 0;
    private new_index: number = 0;
    private to_string: number = 0;

    constructor(luaApi: LuaApi) {
        this.luaApi = luaApi;
    }

    /**
     * 注册gc函数
     * @param thread
     * @returns
     */
    registerGcFunction(thread: LuaThread): number {
        if (this.gc) {
            return this.gc;
        }
        const pointer = thread.luaApi.module.addFunction((L: LuaState) => {
            const callThread = thread.stateToThread(L);
            const userdata = callThread.luaApi.lua_touserdata(L, 1);
            // 删掉indexMap中的引用
            const pointer = callThread.luaApi.lua_topointer(L, 1);
            const functionPointer = this.pointerRedirect.get(pointer);
            this.removeIndexRedirect(functionPointer as number);
            // unref掉js方面的引用
            const ref = callThread.luaApi.module.getValue(userdata, '*');
            thread.luaApi.unref(ref);
            // 需要remove掉单独因为该对象添加进wasm的方法
            callThread.luaApi.lua_getmetatable(L, 1);
            if (callThread.luaApi.lua_type(L, -1) === LuaType.Nil) {
                // 没有metatable，直接返回
                callThread.luaApi.lua_pop(L, 1);
                return LuaReturn.Ok;
            }
            callThread.luaApi.lua_getfield(L, -1, '__func_pointers');
            if (callThread.luaApi.lua_type(L, -1) !== LuaType.Table) {
                // 没有__func_pointer或值不是table，直接返回
                callThread.luaApi.lua_pop(L, 2);
                return LuaReturn.Ok;
            }
            callThread.luaApi.lua_pushnil(L);
            // 遍历清除所有的方法
            while (callThread.luaApi.lua_next(L, -2) !== 0) {
                const funcPointer = callThread.luaApi.lua_tonumber(L, -1);
                callThread.luaApi.module.removeFunction(funcPointer);
                callThread.luaApi.lua_pop(L, 1);
            }
            return LuaReturn.Ok;
        }, 'ii');
        this.gc = pointer;
        return pointer;
    }

    /**
     * 注册调用函数，用于传入了一个不是function的值可以直接被调用的情况
     * @param thread
     */
    registerCallFunction(thread: LuaThread): number {
        if (this.call) {
            return this.call;
        }
        const pointer = thread.luaApi.module.addFunction((L: LuaState) => {
            const callThread = thread.stateToThread(L);
            const top = callThread.getTop();
            const target = callThread.getValue(1);
            const args = [];
            for (let i = 2; i <= top; i++) {
                args.push(callThread.getValue(i));
            }

            try {
                const result = target(...args);
                callThread.pushValue(result);
                return 1;
            } catch (e: any) {
                if (typeof e?.message === 'string') {
                    callThread.pushValue(e?.message);
                } else {
                    callThread.pushValue('Error: An exception occurred during the process of calling a JavaScript function.');
                }
                callThread.luaApi.lua_error(L);
            }
            return 0;
        }, 'ii');
        this.call = pointer;
        return pointer;
    }

    /**
     * 注册的调用函数，用于传入一个function，实则被表示为userdata
     * 然后在lua里面将其进行一层包装成为一个closure的情况
     * @param thread
     */
    registerFuncCallFunction(thread: LuaThread): number {
        if (this.func_call) {
            return this.func_call;
        }
        const pointer = thread.luaApi.module.addFunction((L: LuaState) => {
            const callThread = thread.stateToThread(L);
            const top = callThread.getTop();
            const args = [];
            for (let i = 1; i <= top; i++) {
                args.push(callThread.getValue(i));
            }
            const userdata = callThread.luaApi.lua_touserdata(L, callThread.luaApi.lua_upvalueindex(1));
            const ref = callThread.luaApi.module.getValue(userdata, '*');
            const func = thread.luaApi.getRef(ref);
            try {
                const result = func.apply(thread, args);
                callThread.pushValue(result);
                return 1;
            } catch (e: any) {
                if (typeof e?.message === 'string') {
                    callThread.pushValue(e?.message);
                } else {
                    callThread.pushValue('Error: An exception occurred during the process of calling a JavaScript function.');
                }
                callThread.luaApi.lua_error(L);
            }
            return 0;
        }, 'ii');
        this.func_call = pointer;
        return pointer;
    }

    /**
     * 注册一个index函数，支持重定向target
     */
    registerIndexFunction(thread: LuaThread): number {
        if (this.index) {
            return this.index;
        }
        const pointer = thread.luaApi.module.addFunction((L: LuaState) => {
            const callThread = thread.stateToThread(L);
            const key = callThread.getValue(2);

            // 尝试找重定向的target，找到了直接返回对应值
            const pointer = callThread.luaApi.lua_topointer(L, 1);
            const target = this.indexMap.get(pointer);
            if (target) {
                const value = target[key];
                callThread.pushValue(typeof value === 'function' ? value.bind(target) : value);
                return 1;
            }

            // 没有找到重定向的target，直接从userdata对应的对象身上找
            const userdata = callThread.luaApi.lua_touserdata(L, 1);
            const ref = callThread.luaApi.module.getValue(userdata, '*');
            const tar = thread.luaApi.getRef(ref);
            const value = tar?.[key];
            callThread.pushValue(typeof value === 'function' ? value.bind(tar) : value);
            return 1;
        }, 'ii');
        this.index = pointer;
        return pointer;
    }

    /**
     * 注册一个newindex函数，支持重定向target
     */
    registerNewIndexFunction(thread: LuaThread): number {
        if (this.new_index) {
            return this.new_index;
        }
        const pointer = thread.luaApi.module.addFunction((L: LuaState) => {
            const callThread = thread.stateToThread(L);
            const key = callThread.getValue(2);
            const value = callThread.getValue(3);

            // 尝试找重定向的target，找到了就在target上设置
            const pointer = callThread.luaApi.lua_topointer(L, 1);
            const target = this.indexMap.get(pointer);
            if (target) {
                target[key] = value;
                return LuaReturn.Ok;
            }

            // 没有找到重定向的target，直接从userdata对应的对象身上设置
            const userdata = callThread.luaApi.lua_touserdata(L, 1);
            const ref = callThread.luaApi.module.getValue(userdata, '*');
            thread.luaApi.getRef(ref)[key] = value;
            return LuaReturn.Ok;
        }, 'ii');
        this.new_index = pointer;
        return pointer;
    }

    /**
     * 注册一个tostring函数，支持重定向target
     */
    registerToStringFunction(thread: LuaThread): number {
        if (this.to_string) {
            return this.to_string;
        }
        const pointer = thread.luaApi.module.addFunction((L: LuaState) => {
            const callThread = thread.stateToThread(L);

            // 尝试找重定向的target，找到了直接返回对应值
            const pointer = callThread.luaApi.lua_topointer(L, 1);
            const typename = callThread.luaApi.luaL_typename(L, 1);
            const target = this.indexMap.get(pointer);
            if (target) {
                callThread.pushValue(`${typename}: 0x${pointer.toString(16)} -> ${target.toString()}`);
                return 1;
            }

            // 没有找到重定向的target，直接从userdata对应的对象身上找
            const userdata = callThread.luaApi.lua_touserdata(L, 1);
            const ref = callThread.luaApi.module.getValue(userdata, '*');
            const value = thread.luaApi.getRef(ref).toString();
            callThread.pushValue(`${typename}: 0x${pointer.toString(16)} -> ${value}`);
            return 1;
        }, 'ii');
        this.to_string = pointer;
        return pointer;
    }

    /**
     * 为index以及newindex注册一个重定向。
     * 因为注册lua的function本身是一个closure不包含target的信息。
     * 所以在js层面需要维护这么一个映射关系
     * @param pointer
     * @param target
     */
    addIndexRedirect(pointer: number, target: any): void {
        if (!pointer) {
            return;
        }
        this.indexMap.set(pointer, target);
    }

    /**
     * 删除重定向关系，用于gc的时候
     * @param pointer
     */
    removeIndexRedirect(pointer: number): void {
        if (!pointer) {
            return;
        }
        this.indexMap.delete(pointer);
    }
}
