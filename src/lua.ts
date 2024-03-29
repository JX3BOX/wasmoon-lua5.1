import { FuncManager } from './func-manager';
import { JsType } from './js-type-bind';
import { PointerSize } from './definitions';
import { version } from '../package.json';
import LuaApi from './api';
import LuaGlobal from './global';
import LuaThread from './thread';
import getContextProxy from './context';

export default class Lua {
    // 静态方法 初始化一个Lua实例
    public static async create(options: LuaCreateOptions = {}): Promise<Lua> {
        options = {
            openStandardLibs: true,
            traceAllocations: false,
            ...options,
        };
        if (!options.customWasmUri) {
            const isBrowser =
                (typeof window === 'object' && typeof window.document !== 'undefined') ||
                (typeof self === 'object' && self?.constructor?.name === 'DedicatedWorkerGlobalScope');

            if (isBrowser) {
                options.customWasmUri = `https://unpkg.com/wasmoon-lua5.1@${version}/dist/liblua5.1.wasm`;
            }
        }
        const luaApi = await LuaApi.initialize(options.customWasmUri, options.environmentVariables);
        return new Lua(luaApi, options);
    }

    public global: LuaGlobal;
    public ctx: LuaContext;
    public luaApi: LuaApi;
    public funcManager: FuncManager;

    // 构造方法
    constructor(luaApi: LuaApi, options: LuaCreateOptions) {
        if (!options) {
            // 必须通过静态方法创建，不允许直接new
            throw new Error('Lua.create(options) must be used to create a Lua instance');
        }
        this.luaApi = luaApi;

        // const __addFunction = this.luaApi.module.addFunction.bind(this.luaApi.module);
        // this.luaApi.module.addFunction = (fn: (...args: any[]) => any, signature?: string | undefined) => {
        //     const pointer = __addFunction(fn, signature);
        //     console.log(pointer)
        //     return pointer;
        // }

        this.global = new LuaGlobal(this.luaApi, options.traceAllocations);

        // 类型绑定
        this.funcManager = new FuncManager(this.luaApi);
        this.initTypeBindings();
        // Lua上下文代理
        this.ctx = getContextProxy(this.global);

        if (options.openStandardLibs) {
            this.luaApi.luaL_openlibs(this.global.address);
        }
    }

    public mountFile(path: string, content: string | ArrayBufferView): void {
        const fileSep = path.lastIndexOf('/');
        const file = path.substring(fileSep + 1);
        const body = path.substring(0, path.length - file.length - 1);

        if (body.length > 0) {
            const parts = body.split('/').reverse();
            let parent = '';

            while (parts.length) {
                const part = parts.pop();
                if (!part) {
                    continue;
                }

                const current = `${parent}/${part}`;
                try {
                    this.luaApi.module.FS.mkdir(current);
                } catch (err) {
                    // ignore EEXIST
                }

                parent = current;
            }
        }

        this.luaApi.module.FS.writeFile(path, content);
    }

    public unmountFile(path: string): void {
        this.luaApi.module.FS.unlink(path);
    }

    public doString(script: string): Promise<any> {
        const result = this.callByteCode((thread) => thread.loadString(script));
        return result;
    }

    public doFile(filename: string): Promise<any> {
        return this.callByteCode((thread) => thread.loadFile(filename));
    }

    public doStringSync(script: string): any {
        this.global.loadString(script);
        const result = this.global.runSync();
        return result[0];
    }

    public doFileSync(filename: string): any {
        this.global.loadFile(filename);
        const result = this.global.runSync();
        return result[0];
    }

    private initTypeBindings(): void {
        JsType.create('js-function', (value: any) => typeof value === 'function' && !value.toString().startsWith('class'))
            .gc(this.funcManager.registerGcFunction(this.global))
            .push(({ thread, target }) => {
                const ref = thread.luaApi.ref(target);
                const luaPointer = thread.luaApi.lua_newuserdata(thread.address, PointerSize);
                thread.luaApi.module.setValue(luaPointer, ref, '*');
                thread.luaApi.luaL_getmetatable(thread.address, 'js-function');
                thread.luaApi.lua_setmetatable(thread.address, -2);
                thread.luaApi.lua_pushcclosure(thread.address, this.funcManager.registerFuncCallFunction(this.global), 1);
                const pointer = thread.luaApi.lua_topointer(thread.address, -1);

                // 注册一个指针映射，从userdata到function。用于gc的时候删除对应的pointer
                this.funcManager.pointerRedirect.set(luaPointer, pointer);
                // 注册一个index映射，当尝试从function上索引/tostring值的时候，回溯userdata代表的js对象
                this.funcManager.addIndexRedirect(pointer, target);

                // proxy for function, avoid `attempt to index global 'TestFunction' (a function value)`
                thread.luaApi.lua_createtable(thread.address, 0, 0);
                thread.luaApi.lua_pushcfunction(thread.address, this.funcManager.registerToStringFunction(this.global));
                thread.luaApi.lua_setfield(thread.address, -2, '__tostring');
                thread.luaApi.lua_pushcfunction(thread.address, this.funcManager.registerIndexFunction(this.global));
                thread.luaApi.lua_setfield(thread.address, -2, '__index');
                thread.luaApi.lua_pushcfunction(thread.address, this.funcManager.registerNewIndexFunction(this.global));
                thread.luaApi.lua_setfield(thread.address, -2, '__newindex');

                thread.luaApi.lua_setmetatable(thread.address, -2);
            })
            .bind(this.global);

        JsType.create('js-userdata', () => true)
            .gc(this.funcManager.registerGcFunction(this.global))
            .call(this.funcManager.registerCallFunction(this.global))
            .index(this.funcManager.registerIndexFunction(this.global))
            .newindex(this.funcManager.registerNewIndexFunction(this.global))
            .tostring(this.funcManager.registerToStringFunction(this.global))
            .priority(-1)
            .bind(this.global);
    }

    // WARNING: It will not wait for open handles and can potentially cause bugs if JS code tries to reference Lua after executed
    private async callByteCode(loader: (thread: LuaThread) => void): Promise<any> {
        const thread = this.global.newThread();
        const threadIndex = this.global.getTop();
        try {
            loader(thread);
            const result = await thread.run(0);
            if (result.length > 0) {
                // Move all stack results to the global state to avoid referencing the thread values
                // which will be cleaned up in the finally below.
                this.luaApi.lua_xmove(thread.address, this.global.address, result.length);
                // The shenanigans here are to return the first result value on the stack.
                // Say there's 2 values at stack indexes 1 and 2. Then top is 2, result.length is 2.
                // That's why there's a + 1 sitting at the end.
                const ret = this.global.getValue(this.global.getTop() - result.length + 1);
                return ret;
            }
            return undefined;
        } finally {
            // Pop the read on success or failure
            this.global.remove(threadIndex);
        }
    }
}
