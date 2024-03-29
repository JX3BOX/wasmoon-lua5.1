import * as lodash from 'lodash';
import { JsType } from './js-type-bind';
import { LUA_MULTRET, LUA_REGISTRYINDEX, LuaEventMasks, LuaReturn, LuaType, PointerSize } from './definitions';
import { LuaDebug } from './lua-debug';
import { getTable } from './table';
import MultiReturn from './multireturn';
import type LuaApi from './api';

// When the debug count hook is set, call it every X instructions.
const INSTRUCTION_HOOK_COUNT = 1000;

export default class LuaThread {
    public readonly address: LuaState;
    public luaApi: LuaApi;
    private closed = false;
    private hookFunctionPointer: number | undefined;
    private timeout?: number;
    private parent?: LuaThread;
    private types: JsType[] = [];

    public constructor(luaApi: LuaApi, address: LuaState, parent?: LuaThread) {
        this.luaApi = luaApi;
        this.address = address;
        this.parent = parent;
        this.types = parent?.types || [];
    }

    //============值操作
    public newThread(): LuaThread {
        const address = this.luaApi.lua_newthread(this.address);
        if (!address) {
            throw new Error('lua_newthread returned a null pointer');
        }
        return new LuaThread(this.luaApi, address, this.parent || this);
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

    public getType(index: number): LuaType {
        return this.luaApi.lua_type(this.address, index);
    }

    public isBasicValue(index: number): boolean {
        const type = this.luaApi.lua_type(this.address, index);
        return [LuaType.Nil, LuaType.Boolean, LuaType.Number, LuaType.String].includes(type);
    }

    public pushBasicValue(target: unknown, options: PushValueOptions): boolean {
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
            return false;
        }
        return true;
    }

    public pushValue(target: unknown, options: PushValueOptions = {}): void {
        const startTop = this.getTop();
        if (target instanceof JsType) {
            // 如果值是JsType decorate, 针对这一个值设置metatable
            if (target._push) {
                target._push({ thread: this, target: target.value, options });
            } else {
                if (!this.pushBasicValue(target.value, options)) {
                    const ref = this.luaApi.ref(target.value);
                    const luaPointer = this.luaApi.lua_newuserdata(this.address, PointerSize);
                    this.luaApi.module.setValue(luaPointer, ref, '*');
                }

                this.luaApi.lua_createtable(this.address, 0, 0);
                target._pushMetaTable(this);
                this.luaApi.lua_setmetatable(this.address, -2);
            }
        } else if (target instanceof LuaThread) {
            // 如果值是线程
            const isMain = this.luaApi.lua_pushthread(target.address) === 1;
            if (!isMain) {
                this.luaApi.lua_xmove(target.address, this.address, 1);
            }
            return;
        } else if (target && (target as LuaTable).$istable) {
            // 如果是从lua里拿出来的table，则直接返回
            const ref = (target as LuaTable).$getRef();
            this.luaApi.lua_rawgeti(this.address, LUA_REGISTRYINDEX, ref);
            return;
        } else {
            // js-lua 类型之间的转换
            if (!this.pushBasicValue(target, options)) {
                // 其他类型没有对应的lua类型，当userdata处理，找到对应js类型的metatable，绑定上
                const type = this.types.find((t) => (t.match as (...args: any[]) => any)(target)) as JsType;

                if (type._push) {
                    // 类型自定义push行为
                    type._push({ thread: this, target, options, type });
                } else {
                    // 默认push行为
                    const ref = this.luaApi.ref(target);
                    const luaPointer = this.luaApi.lua_newuserdata(this.address, PointerSize);
                    this.luaApi.module.setValue(luaPointer, ref, '*');

                    this.luaApi.luaL_getmetatable(this.address, type?._name);
                    this.luaApi.lua_setmetatable(this.address, -2);
                }
            }
        }

        if (this.getTop() !== startTop + 1) {
            throw new Error(`pushValue expected stack size ${startTop + 1}, got ${this.getTop()}`);
        }
    }

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
                this.pushValue(key, options);
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
            return this.getTable(index);
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
        const funcRef = this.luaApi.luaL_ref(this.address, LUA_REGISTRYINDEX);
        const pointer = this.luaApi.lua_topointer(this.address, index);

        if (this.luaApi.pointerRefs.has(pointer)) {
            return this.luaApi.pointerRefs.get(pointer) as (...args: any[]) => any;
        }

        const func = (...args: any[]): any => {
            if (!func.$isAlive()) {
                throw new Error('Tried to call a function that has been destroyed');
            }
            if (this.isClosed()) {
                console.warn('Tried to call a function after closing lua state');
                return;
            }

            const thread = this.newThread();
            thread.luaApi.lua_rawgeti(thread.address, LUA_REGISTRYINDEX, funcRef);
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
                this.pop();
            }
        };
        func.$isAlive = () => true;
        func.$destroy = () => {
            this.luaApi.luaL_unref(this.address, LUA_REGISTRYINDEX, funcRef);
            this.luaApi.pointerRefs.delete(pointer);
            func.$isAlive = () => false;
        };
        this.luaApi.pointerRefs.set(pointer, func);
        return func;
    }

    public getTable(index: number): Record<string | number, any> {
        return getTable(this, index);
    }

    public stateToThread(L: LuaState): LuaThread {
        return L === this.parent?.address ? this.parent : new LuaThread(this.luaApi, L, this.parent || this);
    }

    public pop(count = 1): void {
        this.luaApi.lua_pop(this.address, count);
    }

    //============代码执行
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

    public call(name: string, ...args: any[]): MultiReturn {
        const type = this.luaApi.lua_getglobal(this.address, name);
        if (type !== LuaType.Function) {
            throw new Error(`A function of type '${type}' was pushed, expected is ${LuaType.Function}`);
        }

        for (const arg of args) {
            this.pushValue(arg);
        }

        const base = this.getTop() - args.length - 1; // The 1 is for the function to run
        this.luaApi.lua_call(this.address, args.length, LUA_MULTRET);
        return this.getStackValues(base);
    }

    public getStackValues(start = 0): MultiReturn {
        const returns = this.getTop() - start;
        const returnValues = new MultiReturn(returns);

        for (let i = 0; i < returns; i++) {
            returnValues[i] = this.getValue(start + i + 1);
        }
        return returnValues;
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
                    throw new Error(`thread timeout exceeded`);
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
        const luaResult = this.luaApi.lua_resume(this.address, argCount);
        return {
            result: luaResult,
            resultCount: this.getTop(),
        };
    }

    // Set to > 0 to enable, otherwise disable.
    public setTimeout(timeout: number | undefined): void {
        if (timeout && timeout > 0) {
            if (!this.hookFunctionPointer) {
                this.hookFunctionPointer = this.luaApi.module.addFunction((): void => {
                    if (Date.now() > timeout) {
                        this.pushValue(new Error(`thread timeout exceeded`));
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

    public assertOk(result: LuaReturn): void {
        if (result !== LuaReturn.Ok && result !== LuaReturn.Yield) {
            const resultString = LuaReturn[result];
            // This is the default message if there's nothing on the stack.
            let error = new Error(`Lua Error(${resultString}/${result})`);
            if (this.getTop() > 0) {
                if (result === LuaReturn.ErrorMem) {
                    // If there's no memory just do a normal to string.
                    error.message = this.luaApi.lua_tolstring(this.address, -1, null);
                } else {
                    const luaError = this.getValue(-1);
                    if (luaError instanceof Error) {
                        error = luaError;
                    } else {
                        error.message = this.indexToString(-1);
                    }
                }
            }

            if (result !== LuaReturn.ErrorMem) {
                const pointer = this.luaApi.module._malloc(LuaDebug.structSize);
                try {
                    let level = 0;
                    const luaDebug = new LuaDebug(pointer, this.luaApi.module, error.message);
                    while (this.luaApi.lua_getstack(this.address, level, pointer)) {
                        this.luaApi.lua_getinfo(this.address, 'nSlu', pointer);
                        luaDebug.read();
                        level++;
                    }
                    error.message = luaDebug.getMessage();
                } catch (err) {
                    console.warn('Error in generate stack trace', err);
                } finally {
                    this.luaApi.module._free(pointer);
                }
            }

            throw error;
        }
    }

    //============调试用
    public getGlobalPointer(name: string): number {
        this.luaApi.lua_getglobal(this.address, name);
        const pointer = this.getPointer(-1);
        this.pop();
        return pointer;
    }

    public getPointer(index: number): number {
        return this.luaApi.lua_topointer(this.address, index);
    }

    public indexToString(index: number): string {
        const str = this.luaApi.luaL_tolstring(this.address, index);
        this.pop();
        return str;
    }

    // 调试用 输出栈信息
    public dumpStack(log = console.log): void {
        const top = this.getTop();

        for (let i = 1; i <= top; i++) {
            const typename = this.luaApi.luaL_typename(this.address, i);
            const pointer = this.getPointer(i).toString();
            const name = this.indexToString(i);
            log(i, typename, pointer, name);
        }
    }

    // 调试用 输出所有注册的类型
    public dumpTypes(log = console.log): void {
        for (const type of this.types) {
            log(type._name, type._priority);
        }
    }
}
