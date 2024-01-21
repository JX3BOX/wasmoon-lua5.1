import * as lodash from 'lodash';
import { JsType } from './type-bind';
import { LUA_MULTRET, LUA_REGISTRYINDEX, LuaEventMasks, LuaReturn, LuaTimeoutError, LuaType, PointerSize } from './definitions';
import MultiReturn from './multireturn';
import Pointer from './utils/pointer';
import type LuaApi from './api';
import { mapTransform } from './utils/map';

// When the debug count hook is set, call it every X instructions.
const INSTRUCTION_HOOK_COUNT = 1000;

export default class LuaThread {
    public readonly address: LuaState;
    public readonly luaApi: LuaApi;
    private closed = false;
    private hookFunctionPointer: number | undefined;
    private timeout?: number;
    private readonly parent?: LuaThread;
    private types: JsType[] = [];

    public constructor(luaApi: LuaApi, address: LuaState, parent?: LuaThread) {
        this.luaApi = luaApi;
        this.address = address;
        this.parent = parent;
        this.types = parent?.types || [];
    }

    public newThread(): LuaThread {
        const address = this.luaApi.lua_newthread(this.address);
        if (!address) {
            throw new Error('lua_newthread returned a null pointer');
        }
        return new LuaThread(this.luaApi, address, this.parent || this);
    }

    public async run(argCount = 0, options?: Partial<LuaThreadRunOptions>): Promise<MultiReturn> {
        const originalTimeout = this.timeout;
        try {
            if (options?.timeout !== undefined) {
                this.setTimeout(Date.now() + options.timeout);
            }
            let resumeResult: LuaResumeResult = this.resume(argCount);
            while (resumeResult.result === LuaReturn.Yield) {
                // If it's yielded check the timeout. If it's completed no need to
                // needlessly discard the output.
                if (this.timeout && Date.now() > this.timeout) {
                    if (resumeResult.resultCount > 0) {
                        this.pop(resumeResult.resultCount);
                    }
                    throw new LuaTimeoutError(`thread timeout exceeded`);
                }
                if (resumeResult.resultCount > 0) {
                    const lastValue = this.getValue(-1);
                    this.pop(resumeResult.resultCount);

                    // If there's a result and it's a promise, then wait for it.
                    if (lastValue === Promise.resolve(lastValue)) {
                        await lastValue;
                    } else {
                        // If it's a non-promise, then skip a tick to yield for promises, timers, etc.
                        await new Promise((resolve) => setImmediate(resolve));
                    }
                } else {
                    // If there's nothing to yield, then skip a tick to yield for promises, timers, etc.
                    await new Promise((resolve) => setImmediate(resolve));
                }

                resumeResult = this.resume(0);
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this.assertOk(resumeResult.result);
            return this.getStackValues();
        } finally {
            if (options?.timeout !== undefined) {
                this.setTimeout(originalTimeout);
            }
        }
    }

    public runSync(argCount = 0): MultiReturn {
        const base = this.getTop() - argCount - 1; // The 1 is for the function to run
        this.assertOk(this.luaApi.lua_pcall(this.address, argCount, LUA_MULTRET, 0) as LuaReturn);
        return this.getStackValues(base);
    }

    public isClosed(): boolean {
        return !this.address || this.closed || Boolean(this.parent?.isClosed());
    }

    public close(): void {
        if (this.isClosed()) {
            return;
        }

        if (this.hookFunctionPointer) {
            this.luaApi.module.removeFunction(this.hookFunctionPointer);
        }

        this.closed = true;
    }

    public resetThread(): void {
        this.luaApi.lua_close(this.address);
    }

    public resume(argCount = 0): LuaResumeResult {
        // TODO: lua5.1 和 lua5.4 的协程相关机制有点变化 没看懂 到时候再改
        const dataPointer = this.luaApi.module._malloc(PointerSize);
        try {
            this.luaApi.module.setValue(dataPointer, 0, 'i32');
            const luaResult = this.luaApi.lua_resume(this.address, argCount);
            return {
                result: luaResult,
                resultCount: this.luaApi.module.getValue(dataPointer, 'i32'),
            };
        } finally {
            this.luaApi.module._free(dataPointer);
        }
    }

    // Set to > 0 to enable, otherwise disable.
    public setTimeout(timeout: number | undefined): void {
        if (timeout && timeout > 0) {
            if (!this.hookFunctionPointer) {
                this.hookFunctionPointer = this.luaApi.module.addFunction((): void => {
                    if (Date.now() > timeout) {
                        this.pushValue(new LuaTimeoutError(`thread timeout exceeded`));
                        this.luaApi.lua_error(this.address);
                    }
                }, 'vii');
            }

            this.luaApi.lua_sethook(this.address, this.hookFunctionPointer, LuaEventMasks.Count, INSTRUCTION_HOOK_COUNT);
            this.timeout = timeout;
        } else if (this.hookFunctionPointer) {
            this.hookFunctionPointer = undefined;
            this.timeout = undefined;
            this.luaApi.lua_sethook(this.address, null, 0, 0);
        }
    }

    public getTimeout(): number | undefined {
        return this.timeout;
    }

    public bindType(type: JsType): void {
        this.types.unshift(type);
        this.types.sort((a, b) => b._priority - a._priority);
    }

    public getTop(): number {
        return this.luaApi.lua_gettop(this.address);
    }

    public setTop(index: number): void {
        this.luaApi.lua_settop(this.address, index);
    }

    public remove(index: number): void {
        return this.luaApi.lua_remove(this.address, index);
    }

    public pushValue(target: unknown, options: PushValueOptions = {}): void {
        // 如果值是线程
        if (target instanceof LuaThread) {
            const isMain = this.luaApi.lua_pushthread(target.address) === 1;
            if (!isMain) {
                this.luaApi.lua_xmove(target.address, this.address, 1);
            }
            return;
        }

        const startTop = this.getTop();
        // js-lua 类型之间的转换
        if (target === undefined || target === null) {
            this.luaApi.lua_pushnil(this.address);
        } else if (typeof target === 'number') {
            if (Number.isInteger(target)) {
                this.luaApi.lua_pushinteger(this.address, target);
            } else {
                this.luaApi.lua_pushnumber(this.address, target);
            }
        } else if (typeof target === 'string') {
            this.luaApi.lua_pushstring(this.address, target);
        } else if (typeof target === 'boolean') {
            this.luaApi.lua_pushboolean(this.address, target ? 1 : 0);
        } else if (lodash.isPlainObject(target) || lodash.isArray(target)) {
            this.pushTable(target as Record<string | number, any>, options);
        } else {
            // 其他类型没有对应的lua类型，当userdata处理，找到对应js类型的metatable，绑定上
            const type = this.types.find((t) => t.match(target)) as JsType;
            if (type._push) {
                // 类型自定义push行为
                type._push({ thread: this, target, options });
            } else {
                // 默认push行为
                const ref = this.luaApi.ref(target);
                const luaPointer = this.luaApi.lua_newuserdata(this.address, PointerSize);
                this.luaApi.module.setValue(luaPointer, ref, '*');

                this.luaApi.luaL_getmetatable(this.address, type?._name);
                this.luaApi.lua_setmetatable(this.address, -2);
            }
        }

        if (this.getTop() !== startTop + 1) {
            throw new Error(`pushValue expected stack size ${startTop + 1}, got ${this.getTop()}`);
        }
    }

    // js的plainObject和array - lua的table
    public pushTable(object: Record<string | number, any>, options: PushValueOptions = {}): void {
        if (!options.refs) {
            options.refs = new Map();
        } else {
            const ref = options.refs.get(object);
            if (ref) {
                this.luaApi.lua_rawgeti(this.address, LUA_REGISTRYINDEX, ref);
                return;
            }
        }
        // 正常push流程
        // 区分顺序部分和关联部分
        const arrIndexs: number[] = [];
        const recIndexs: string[] = [];
        if (lodash.isArray(object)) {
            // js的数组也可能存在非number的键
            const keys = Object.keys(object);
            keys.forEach((key) => {
                if (!isNaN(Number(key))) {
                    arrIndexs.push(Number(key));
                } else {
                    recIndexs.push(key);
                }
            });
        } else if (lodash.isPlainObject(object)) {
            // 对象直接丢进去
            recIndexs.push(...Object.keys(object));
        }

        this.luaApi.lua_createtable(this.address, arrIndexs.length, recIndexs.length);
        // 存一下引用 方便检查 防止循环引用爆栈
        const ref = this.luaApi.luaL_ref(this.address, LUA_REGISTRYINDEX);
        this.luaApi.lua_rawgeti(this.address, LUA_REGISTRYINDEX, ref);
        options.refs.set(object, ref);

        try {
            for (const key of arrIndexs) {
                this.pushValue(key + 1, options);
                this.pushValue(object[key], options);
                this.luaApi.lua_settable(this.address, -3);
            }
            for (const key of recIndexs) {
                this.pushValue(key, options);
                this.pushValue(object[key], options);
                this.luaApi.lua_settable(this.address, -3);
            }
        } finally {
            const registerRefs = options.refs.values();
            for (const ref of registerRefs) {
                this.luaApi.luaL_unref(this.address, LUA_REGISTRYINDEX, ref);
            }
        }
    }

    public getValue(index: number, options: GetValueOptions = {}): any {
        index = this.luaApi.lua_absindex(this.address, index);

        const type: LuaType = options.type ?? this.luaApi.lua_type(this.address, index);
        if (type === LuaType.None) {
            return undefined;
        } else if (type === LuaType.Nil) {
            return null;
        } else if (type === LuaType.Number) {
            return this.luaApi.lua_tonumber(this.address, index);
        } else if (type === LuaType.String) {
            return this.luaApi.lua_tolstring(this.address, index, null);
        } else if (type === LuaType.Boolean) {
            return Boolean(this.luaApi.lua_toboolean(this.address, index));
        } else if (type === LuaType.Thread) {
            return this.stateToThread(this.luaApi.lua_tothread(this.address, index));
        } else if (type === LuaType.Table) {
            return this.getTable(index, options);
        } else if (type === LuaType.Function) {
            return this.getFunction(index);
        } else if (type === LuaType.Userdata) {
            const userdata = this.luaApi.lua_touserdata(this.address, index);
            const ref = this.luaApi.module.getValue(userdata, '*');
            return this.luaApi.getRef(ref);
        }
    }

    public getFunction(index: number): (...args: any[]) => any {
        this.luaApi.lua_pushvalue(this.address, index);
        const func = this.luaApi.luaL_ref(this.address, LUA_REGISTRYINDEX);

        return (...args: any[]): any => {
            const thread = this.newThread();
            thread.luaApi.lua_rawgeti(thread.address, LUA_REGISTRYINDEX, func);
            try {
                for (const arg of args) {
                    thread.pushValue(arg);
                }
                const status: LuaReturn = thread.luaApi.lua_pcall(thread.address, args.length, 1, 0);
                if (status === LuaReturn.Yield) {
                    throw new Error('cannot yield in callbacks from javascript');
                }
                thread.assertOk(status);
                if (thread.getTop() > 0) {
                    return thread.getValue(-1);
                }
                return undefined;
            } finally {
                thread.close();
            }
        };
    }

    // lua的table太奔放了 甚至键可以是自身 js里可以匹配的数据结构只有Map
    public getTable(index: number, options: GetValueOptions = {}): Record<string | number, any> {
        const table = new Map();

        if (!options.refs) {
            options.refs = new Map<number, any>();
        }
        const pointer = this.luaApi.lua_topointer(this.address, index);
        if (pointer) {
            const target = options.refs.get(pointer);
            if (target) {
                return target;
            }
        }
        options.refs.set(pointer, table);

        this.luaApi.lua_pushnil(this.address);
        while (this.luaApi.lua_next(this.address, index) !== 0) {
            const key = this.getValue(-2, options);
            const value = this.getValue(-1, options);
            if (typeof key === 'number') {
                table.set(key - 1, value);
            } else {
                table.set(key, value);
            }
            this.pop();
        }

        // Map to object/array
        return mapTransform(table);
    }

    public pop(count = 1): void {
        this.luaApi.lua_pop(this.address, count);
    }

    public stateToThread(L: LuaState): LuaThread {
        return L === this.parent?.address ? this.parent : new LuaThread(this.luaApi, L, this.parent || this);
    }

    public getMetatableName(index: number): string | undefined {
        const metatableNameType = this.luaApi.luaL_getmetafield(this.address, index, '__name');

        if (metatableNameType === LuaType.Nil) {
            return undefined;
        }

        if (metatableNameType !== LuaType.String) {
            // Pop the metafield if it's not a string
            this.pop(1);
            return undefined;
        }

        const name = this.luaApi.lua_tolstring(this.address, -1, null);
        // This is popping the luaL_getmetafield result which only pushes with type is not nil.
        this.pop(1);

        return name;
    }

    public setField(index: number, name: string, value: unknown): void {
        index = this.luaApi.lua_absindex(this.address, index);
        this.pushValue(value);
        this.luaApi.lua_setfield(this.address, index, name);
    }

    public loadString(luaCode: string, name?: string): void {
        const size = this.luaApi.module.lengthBytesUTF8(luaCode);
        const pointerSize = size + 1;
        const bufferPointer = this.luaApi.module._malloc(pointerSize);
        try {
            this.luaApi.module.stringToUTF8(luaCode, bufferPointer, pointerSize);
            this.assertOk(this.luaApi.luaL_loadbuffer(this.address, bufferPointer, size, name ?? bufferPointer));
        } finally {
            this.luaApi.module._free(bufferPointer);
        }
    }

    public loadFile(filename: string): void {
        this.assertOk(this.luaApi.luaL_loadfilex(this.address, filename, null));
    }

    public indexToString(index: number): string {
        const str = this.luaApi.luaL_tolstring(this.address, index);
        this.pop();
        return str;
    }

    public assertOk(result: LuaReturn): void {
        if (result !== LuaReturn.Ok && result !== LuaReturn.Yield) {
            const resultString = LuaReturn[result];
            // This is the default message if there's nothing on the stack.
            const error = new Error(`Lua Error(${resultString}/${result})`);
            if (this.getTop() > 0) {
                if (result === LuaReturn.ErrorMem) {
                    // If there's no memory just do a normal to string.
                    error.message = this.luaApi.lua_tolstring(this.address, -1, null);
                } else {
                    this.dumpStack();
                    const luaError = this.getValue(-1);
                    if (luaError instanceof Error) {
                        error.stack = luaError.stack;
                    }

                    // Calls __tostring if it exists and pushes onto the stack.
                    error.message = this.indexToString(-1);
                }
            }

            // Also attempt to get a traceback
            // lua5.1 doesn't have luaL_traceback
            // if (result !== LuaReturn.ErrorMem) {
            //     try {
            //         this.luaApi.luaL_traceback(this.address, this.address, null, 1)
            //         const traceback = this.luaApi.lua_tolstring(this.address, -1, null)
            //         if (traceback.trim() !== 'stack traceback:') {
            //             error.message = `${error.message}\n${traceback}`
            //         }
            //         this.pop(1) // pop stack trace.
            //     } catch (err) {
            //         console.warn('Failed to generate stack trace', err)
            //     }
            // }

            throw error;
        }
    }

    public getPointer(index: number): Pointer {
        return new Pointer(this.luaApi.lua_topointer(this.address, index));
    }

    public getStackValues(start = 0): MultiReturn {
        const returns = this.getTop() - start;
        const returnValues = new MultiReturn(returns);

        for (let i = 0; i < returns; i++) {
            returnValues[i] = this.getValue(start + i + 1);
        }

        return returnValues;
    }

    // 调试用 输出栈信息
    public dumpStack(log = console.log): void {
        const top = this.getTop();

        for (let i = 1; i <= top; i++) {
            const type = this.luaApi.lua_type(this.address, i);
            const typename = this.luaApi.luaL_typename(this.address, i);
            const pointer = this.getPointer(i).toString();
            const name = this.indexToString(i);
            const value = this.getValue(i, { type });
            log(i, typename, pointer, name, value);
        }
    }

    // 调试用 输出所有注册的类型
    public dumpTypes(log = console.log): void {
        for (const type of this.types) {
            log(type._name, type._priority);
        }
    }
}
