import LuaThread from './thread';

declare type CheckTypeFunction = (value: any) => boolean;

declare interface PushParams {
    options?: PushValueOptions;
    thread: LuaThread;
    target: any;
    type?: JsType;
}

export class JsType {
    static create(name: string, is: CheckTypeFunction): JsType {
        return new JsType(name, is);
    }

    static decorate(target: any): JsType {
        const jsType = new JsType();
        jsType.value = target;
        return jsType;
    }

    public match: CheckTypeFunction | undefined;
    public _priority: number = 0;
    public _push?: (params: PushParams) => void;
    public value?: any;

    // metatable
    public _name: string | null = null;
    public _gc?: number;
    public _call?: number;
    public _metatable?: number | string;
    public _tostring?: number | string | ((...args: any[]) => any);
    public _add?: number | ((...args: any[]) => any);
    public _sub?: number | ((...args: any[]) => any);
    public _mul?: number | ((...args: any[]) => any);
    public _div?: number | ((...args: any[]) => any);
    public _mod?: number | ((...args: any[]) => any);
    public _pow?: number | ((...args: any[]) => any);
    public _unm?: number | ((...args: any[]) => any);
    public _concat?: number | ((...args: any[]) => any);
    public _len?: number | ((...args: any[]) => any);
    public _eq?: number | ((...args: any[]) => any);
    public _lt?: number | ((...args: any[]) => any);
    public _le?: number | ((...args: any[]) => any);
    public _index?: number | Record<any, any> | ((...args: any[]) => any);
    public _newindex?: number | Record<any, any> | ((...args: any[]) => any);

    [key: string]: any;

    constructor(name?: string, is?: CheckTypeFunction) {
        this._name = name ?? null;
        this.match = is;
    }

    _pushMetaTable(thread: LuaThread): void {
        if (this._gc) {
            thread.luaApi.lua_pushcfunction(thread.address, this._gc);
            thread.luaApi.lua_setfield(thread.address, -2, '__gc');
        }
        if (this._call) {
            thread.luaApi.lua_pushcfunction(thread.address, this._call);
            thread.luaApi.lua_setfield(thread.address, -2, '__call');
        }

        const ops = [
            'add',
            'sub',
            'mul',
            'div',
            'mod',
            'pow',
            'unm',
            'concat',
            'len',
            'eq',
            'lt',
            'le',
            'index',
            'newindex',
            'metatable',
            'tostring',
        ];
        for (const op of ops) {
            if (this[`_${op}`]) {
                const target = this[`_${op}`];
                if (typeof target === 'number') {
                    thread.luaApi.lua_pushcfunction(thread.address, target);
                } else {
                    thread.pushValue(this[`_${op}`]);
                }
                thread.luaApi.lua_setfield(thread.address, -2, `__${op}`);
            }
        }
    }

    bind(thread: LuaThread): void {
        thread.luaApi.luaL_newmetatable(thread.address, this._name);
        thread.luaApi.lua_pushstring(thread.address, this._name);
        thread.luaApi.lua_setfield(thread.address, -2, '__name');

        this._pushMetaTable(thread);

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

    tostring(value: number | string | ((...args: any[]) => any)): JsType {
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
