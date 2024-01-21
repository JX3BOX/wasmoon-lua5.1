import { version } from '../package.json';
import LuaApi from './api';
import LuaGlobal from './global';
import LuaThread from './thread';
import getContextProxy from './context';

export default class Lua {
    // 静态方法 初始化一个Lua实例
    public static async create(
        options: LuaCreateOptions = {
            openStandardLibs: true,
            traceAllocations: false,
        },
    ): Promise<Lua> {
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

    // 构造方法
    constructor(luaApi: LuaApi, options: LuaCreateOptions) {
        this.luaApi = luaApi;
        this.global = new LuaGlobal(this.luaApi, options.traceAllocations);

        // 类型绑定
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

    public doString(script: string): Promise<any> {
        return this.callByteCode((thread) => thread.loadString(script));
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
        // any
        this.global.bindType({
            name: 'js-userdata',
            match: () => true,
            push_metatable: () => {
                this.luaApi.lua_createtable(this.global.address, 0, 1);
                return true;
            },
        });

        // function
        const funcPointer = this.luaApi.module.addFunction((L: LuaState) => {
            const thread = this.global.stateToThread(L);
            const top = thread.getTop();
            const args = [];
            const func = thread.getValue(1);
            for (let i = 2; i <= top; i++) {
                args.push(thread.getValue(i));
            }

            try {
                const result = func.apply(this.global, args);
                thread.pushValue(result);
                return 1;
            } catch (e: any) {
                if (typeof e?.message === 'string') {
                    thread.pushValue(e?.message);
                } else {
                    thread.pushValue('Error: An exception occurred during the process of calling a JavaScript function.');
                }
                this.luaApi.lua_error(L);
            }
            return 0;
        }, 'ii');

        this.global.bindType({
            name: 'function',
            match: (target: any) => typeof target === 'function',
            push_metatable: () => {
                this.luaApi.lua_createtable(this.global.address, 0, 1);

                this.luaApi.lua_pushstring(this.global.address, '__call');
                this.luaApi.lua_pushcfunction(this.global.address, funcPointer);
                this.luaApi.lua_settable(this.global.address, -3);

                return true;
            },
        });
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
                // The shenanigans here are to return the first reuslt value on the stack.
                // Say there's 2 values at stack indexes 1 and 2. Then top is 2, result.length is 2.
                // That's why there's a + 1 sitting at the end.
                return this.global.getValue(this.global.getTop() - result.length + 1);
            }
            return undefined;
        } finally {
            // Pop the read on success or failure
            this.global.remove(threadIndex);
        }
    }
}
