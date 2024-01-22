import { LuaReturn } from './definitions';
import LuaThread from './thread';

declare type CheckTypeFunction = (value: any) => boolean;

declare interface PushParams {
    options?: PushValueOptions;
    thread: LuaThread;
    target: any;
}

export const registerGcFunction = (thread: LuaThread): number => {
    const gcPointer = thread.luaApi.module.addFunction((L: LuaState) => {
        const callThread = thread.stateToThread(L);
        const userdata = callThread.luaApi.lua_touserdata(L, 1);
        const ref = callThread.luaApi.module.getValue(userdata, '*');
        thread.luaApi.unref(ref);
        return LuaReturn.Ok;
    }, 'ii');
    return gcPointer;
};

export const registerIndexFunction = (thread: LuaThread): number => {
    const indexPointer = thread.luaApi.module.addFunction((L: LuaState) => {
        const callThread = thread.stateToThread(L);
        const userdata = callThread.luaApi.lua_touserdata(L, 1);
        const ref = callThread.luaApi.module.getValue(userdata, '*');
        const key = callThread.getValue(2);
        const value = thread.luaApi.getRef(ref)?.[key];
        callThread.pushValue(value);
        return 1;
    }, 'ii');
    return indexPointer;
};

export const registerNewIndexFunction = (thread: LuaThread): number => {
    const newindexPointer = thread.luaApi.module.addFunction((L: LuaState) => {
        const callThread = thread.stateToThread(L);
        const userdata = callThread.luaApi.lua_touserdata(L, 1);
        const ref = callThread.luaApi.module.getValue(userdata, '*');
        const key = callThread.getValue(2);
        const value = callThread.getValue(3);
        thread.luaApi.getRef(ref)[key] = value;
        return LuaReturn.Ok;
    }, 'ii');
    return newindexPointer;
};

export const registerFuncCallFunction = (thread: LuaThread): number => {
    const callPointer = thread.luaApi.module.addFunction((L: LuaState) => {
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
    return callPointer;
};

export const registerCallFunction = (thread: LuaThread): number => {
    const callPointer = thread.luaApi.module.addFunction((L: LuaState) => {
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
    return callPointer;
};

export class JsType {
    static create(name: string, is: CheckTypeFunction): JsType {
        return new JsType(name, is);
    }

    public match: CheckTypeFunction;
    public _priority: number = 0;
    public _push?: (params: PushParams) => void;

    // metatable
    public _name: string;
    public _gc?: number;
    public _call?: number;
    public _metatable?: number | string;
    public _tostring?: number | string;
    public _add?: number | ((a: any, b: any) => any);
    public _sub?: number;
    public _mul?: number;
    public _div?: number;
    public _mod?: number;
    public _pow?: number;
    public _unm?: number;
    public _index?: number | Record<any, any> | ((...args: any[]) => any);
    public _newindex?: number | Record<any, any>;

    [key: string]: any;

    constructor(name: string, is: CheckTypeFunction) {
        this._name = name;
        this.match = is;
    }

    apply(thread: LuaThread): void {
        thread.luaApi.luaL_newmetatable(thread.address, this._name);
        thread.luaApi.lua_pushstring(thread.address, this._name);
        thread.luaApi.lua_setfield(thread.address, -2, '__name');
        if (this._gc) {
            thread.luaApi.lua_pushcfunction(thread.address, this._gc);
            thread.luaApi.lua_setfield(thread.address, -2, '__gc');
        }
        if (this._call) {
            thread.luaApi.lua_pushcfunction(thread.address, this._call);
            thread.luaApi.lua_setfield(thread.address, -2, '__call');
        }
        if (this._metatable) {
            if (typeof this._metatable === 'number') {
                thread.luaApi.lua_pushcfunction(thread.address, this._metatable);
            } else {
                thread.pushValue(this._metatable);
            }
            thread.luaApi.lua_setfield(thread.address, -2, '__metatable');
        }
        if (this._tostring) {
            if (typeof this._tostring === 'number') {
                thread.luaApi.lua_pushcfunction(thread.address, this._tostring);
            } else {
                thread.pushValue(this._tostring);
            }
            thread.luaApi.lua_setfield(thread.address, -2, '__tostring');
        }
        if (this._add) {
            if (typeof this._add === 'number') {
                thread.luaApi.lua_pushcfunction(thread.address, this._add);
            } //else {
            //     thread.pushValue(this._add);
            // }
            thread.luaApi.lua_setfield(thread.address, -2, '__add');
        }
        if (this._sub) {
            thread.luaApi.lua_pushcfunction(thread.address, this._sub);
            thread.luaApi.lua_setfield(thread.address, -2, '__sub');
        }
        if (this._mul) {
            thread.luaApi.lua_pushcfunction(thread.address, this._mul);
            thread.luaApi.lua_setfield(thread.address, -2, '__mul');
        }
        if (this._div) {
            thread.luaApi.lua_pushcfunction(thread.address, this._div);
            thread.luaApi.lua_setfield(thread.address, -2, '__div');
        }
        if (this._mod) {
            thread.luaApi.lua_pushcfunction(thread.address, this._mod);
            thread.luaApi.lua_setfield(thread.address, -2, '__mod');
        }
        if (this._pow) {
            thread.luaApi.lua_pushcfunction(thread.address, this._pow);
            thread.luaApi.lua_setfield(thread.address, -2, '__pow');
        }
        if (this._unm) {
            thread.luaApi.lua_pushcfunction(thread.address, this._unm);
            thread.luaApi.lua_setfield(thread.address, -2, '__unm');
        }
        if (this._index) {
            if (typeof this._index === 'number') {
                thread.luaApi.lua_pushcfunction(thread.address, this._index);
            } else {
                thread.pushValue(this._index);
            }
            thread.luaApi.lua_setfield(thread.address, -2, '__index');
        }
        if (this._newindex) {
            if (typeof this._newindex === 'number') {
                thread.luaApi.lua_pushcfunction(thread.address, this._newindex);
            } else {
                thread.pushValue(this._newindex);
            }
            thread.luaApi.lua_setfield(thread.address, -2, '__newindex');
        }
        thread.luaApi.lua_pop(thread.address, 1);

        thread.bindType(this);
    }

    push(pushMethod: (params: PushParams) => void): JsType {
        this._push = pushMethod;
        return this;
    }

    priority(priority: number): JsType {
        this._priority = priority;
        return this;
    }

    name(name: string): JsType {
        this._name = name;
        return this;
    }

    gc(funcPointer: number): JsType {
        this._gc = funcPointer;
        return this;
    }

    call(funcPointer: number): JsType {
        this._call = funcPointer;
        return this;
    }

    metatable(value: number | string): JsType {
        this._metatable = value;
        return this;
    }

    tostring(value: number | string): JsType {
        this._tostring = value;
        return this;
    }

    index(funcPointer: number | Record<any, any> | ((...args: any[]) => any)): JsType {
        this._index = funcPointer;
        return this;
    }

    newindex(funcPointer: number | Record<any, any>): JsType {
        this._newindex = funcPointer;
        return this;
    }

    operation(op: string, func: number | ((...args: any[]) => any)): JsType {
        const ops: Record<string, string> = {
            '+': '_add',
            'add': '_add',
            '-': '_sub',
            'sub': '_sub',
            '*': '_mul',
            'mul': '_mul',
            '/': '_div',
            'div': '_div',
            '%': '_mod',
            'mod': '_mod',
            '^': '_pow',
            'pow': '_pow',
            'unm': '_unm',
            '..': '_concat',
            'contact': '_concat',
            '#': '_len',
            'len': '_len',
            '==': '_eq',
            'eq': '_eq',
            '<': '_lt',
            'lt': '_lt',
            '<=': '_le',
            'le': '_le',
        };
        const metakey = ops[op];
        if (!metakey) {
            throw new Error(`Invalid operation: ${op}`);
        }
        this[metakey] = func;
        return this;
    }
}
