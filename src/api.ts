import { LUA_GLOBALSINDEX, LUA_REGISTRYINDEX, LuaReturn, LuaType } from './definitions';
import initWasmModule from '../build/liblua5.1.js';

interface LuaEmscriptenModule extends EmscriptenModule {
    ccall: typeof ccall;
    addFunction: typeof addFunction;
    removeFunction: typeof removeFunction;
    setValue: typeof setValue;
    getValue: typeof getValue;
    FS: typeof FS;
    stringToNewUTF8: typeof allocateUTF8;
    lengthBytesUTF8: typeof lengthBytesUTF8;
    stringToUTF8: typeof stringToUTF8;
    ENV: EnvironmentVariables;
    _realloc: (pointer: number, size: number) => number;
}

interface ReferenceMetadata {
    index: number;
    refCount: number;
}

export default class LuaApi {
    public static async initialize(customWasmFileLocation?: string, environmentVariables?: EnvironmentVariables): Promise<LuaApi> {
        const module: LuaEmscriptenModule = await initWasmModule({
            locateFile: (path: string, scriptDirectory: string) => {
                return customWasmFileLocation || scriptDirectory + path;
            },
            preRun: (initializedModule: LuaEmscriptenModule) => {
                if (typeof environmentVariables === 'object') {
                    Object.entries(environmentVariables).forEach(([k, v]) => (initializedModule.ENV[k] = v));
                }
            },
        });
        return new LuaApi(module);
    }

    public module: LuaEmscriptenModule;

    public luaL_error: (L: LuaState, fmt: string) => void;
    public luaL_argerror: (L: LuaState, arg: number, extramsg: string | null) => number;
    public luaL_typerror: (L: LuaState, arg: number, tname: string | null) => number;

    public luaL_addlstring: (B: number | null, s: string | null, l: number) => void;
    public luaL_addstring: (B: number | null, s: string | null) => void;
    public luaL_addvalue: (B: number | null) => void;

    public luaL_checkany: (L: LuaState, arg: number) => void;
    public luaL_checkinteger: (L: LuaState, arg: number) => number;
    public luaL_checklstring: (L: LuaState, arg: number, l: number | null) => string;
    public luaL_checknumber: (L: LuaState, arg: number) => number;

    public luaL_checkstack: (L: LuaState, sz: number, msg: string | null) => void;
    public luaL_checktype: (L: LuaState, arg: number, t: number) => void;
    public luaL_checkudata: (L: LuaState, ud: number, tname: string | null) => number;

    public luaL_loadbuffer: (L: LuaState, buff: string | number | null, sz: number, name: string | number | null) => LuaReturn;
    public luaL_loadfile: (L: LuaState, filename: string | null) => LuaReturn;
    public luaL_loadfilex: (L: LuaState, filename: string | null, mode: string | null) => LuaReturn; // 5.4
    public luaL_loadstring: (L: LuaState, s: string | null) => LuaReturn;

    public luaL_buffinit: (L: LuaState, B: number | null) => void;
    public luaL_callmeta: (L: LuaState, obj: number, e: string | null) => number;
    public luaL_getmetafield: (L: LuaState, obj: number, e: string | null) => LuaType;
    public luaL_gsub: (L: LuaState, s: string | null, p: string | null, r: string | null) => string;
    public luaL_newmetatable: (L: LuaState, tname: string | null) => number;
    public luaL_newstate: () => LuaState;
    public luaL_openlibs: (L: LuaState) => void;
    public luaL_optinteger: (L: LuaState, arg: number, def: number) => number;
    public luaL_optlstring: (L: LuaState, arg: number, def: string | null, l: number | null) => string;
    public luaL_optnumber: (L: LuaState, arg: number, def: number) => number;
    public luaL_prepbuffer: (B: number | null, sz: number) => string;
    //public luaL_prepbuffsize: (B: number | null, sz: number) => string // 5.4
    public luaL_pushresult: (B: number | null) => void;
    public luaL_pushresultsize: (B: number | null, sz: number) => void; // 5.4
    public luaL_register: (L: LuaState, libname: string | null, l: unknown[]) => void;
    public luaL_ref: (L: LuaState, t: number) => number;
    public luaL_unref: (L: LuaState, t: number, ref: number) => void;
    public luaL_where: (L: LuaState, lvl: number) => void;

    public lua_atpanic: (L: LuaState, panicf: number) => number;
    public lua_call: (L: LuaState, nargs: number, nresults: number) => void;
    public lua_checkstack: (L: LuaState, n: number) => number;
    public lua_close: (L: LuaState) => void;
    public lua_concat: (L: LuaState, n: number) => void;
    public lua_createtable: (L: LuaState, narr: number, nrec: number) => void;
    public lua_dump: (L: LuaState, writer: number | null, data: number | null, strip: number) => number;
    public lua_equal: (L: LuaState, idx1: number, idx2: number) => number;
    public lua_error: (L: LuaState) => number;
    public lua_gc: (L: LuaState, what: number, data: number) => number;
    public lua_getallocf: (L: LuaState, ud: number | null) => number;
    public lua_getfenv: (L: LuaState, idx: number) => void;
    public lua_getfield: (L: LuaState, idx: number, k: string | null) => void;
    public lua_gethook: (L: LuaState) => number;
    public lua_gethookcount: (L: LuaState) => number;
    public lua_gethookmask: (L: LuaState) => number;
    public lua_getinfo: (L: LuaState, what: string | null, ar: number | null) => number;
    public lua_getlocal: (L: LuaState, ar: number | null, n: number) => string;
    public lua_getmetatable: (L: LuaState, objindex: number) => number;
    public lua_getstack: (L: LuaState, level: number, ar: number | null) => number;
    public lua_gettable: (L: LuaState, idx: number) => LuaType;
    public lua_gettop: (L: LuaState) => number;
    public lua_getupvalue: (L: LuaState, funcindex: number, n: number) => string;
    public lua_insert: (L: LuaState, idx: number) => void;

    public lua_lessthan: (L: LuaState, idx1: number, idx2: number) => number;
    public lua_load: (L: LuaState, reader: number | null, data: number | null, chunkname: string | null, mode: string | null) => number;
    public lua_newstate: (f: number | null, ud: number | null) => LuaState;
    public lua_newthread: (L: LuaState) => LuaState;
    public lua_newuserdata: (L: LuaState, sz: number) => number;
    public lua_next: (L: LuaState, idx: number) => number;
    public lua_objlen: (L: LuaState, idx: number) => number;
    public lua_pcall: (L: LuaState, nargs: number, nresults: number, errfunc: number) => number;

    public lua_iscfunction: (L: LuaState, idx: number) => number;
    public lua_isnumber: (L: LuaState, idx: number) => number;
    public lua_isstring: (L: LuaState, idx: number) => number;
    public lua_isuserdata: (L: LuaState, idx: number) => number;

    public lua_pushboolean: (L: LuaState, b: number) => void;
    public lua_pushcclosure: (L: LuaState, fn: number, n: number) => void;
    public lua_pushcfunction: (L: LuaState, f: number) => void;
    public lua_pushfstring: (L: LuaState, fmt: string | null, ...args: any[]) => string;
    public lua_pushinteger: (L: LuaState, n: number) => void;
    public lua_pushlightuserdata: (L: LuaState, p: number) => void;
    public lua_pushlstring: (L: LuaState, s: string | null, l: number) => void;
    public lua_pushnil: (L: LuaState) => void;
    public lua_pushnumber: (L: LuaState, n: number) => void;
    public lua_pushstring: (L: LuaState, s: string | null) => void;
    public lua_pushthread: (L: LuaState) => number;
    public lua_pushvalue: (L: LuaState, idx: number) => void;
    public lua_pushvfstring: (L: LuaState, fmt: string | null, argp: number | null) => string;

    public lua_toboolean: (L: LuaState, idx: number) => number;
    public lua_tocfunction: (L: LuaState, idx: number) => number;
    public lua_tointeger: (L: LuaState, idx: number) => number;
    public lua_tolstring: (L: LuaState, idx: number, len: number | null) => string;
    public lua_tostring: (L: LuaState, idx: number) => string;
    public lua_tonumber: (L: LuaState, idx: number) => number;
    public lua_topointer: (L: LuaState, idx: number) => number;
    public lua_tothread: (L: LuaState, idx: number) => LuaState;
    public lua_touserdata: (L: LuaState, idx: number) => number;

    public lua_rawequal: (L: LuaState, idx1: number, idx2: number) => number;
    public lua_rawget: (L: LuaState, idx: number) => LuaType;
    public lua_rawgeti: (L: LuaState, idx: number, n: number) => LuaType;
    public lua_rawset: (L: LuaState, idx: number) => void;
    public lua_rawseti: (L: LuaState, idx: number, n: number) => void;
    public lua_remove: (L: LuaState, idx: number) => void;
    public lua_replace: (L: LuaState, idx: number) => void;
    public lua_resume: (L: LuaState, nargs: number) => LuaReturn;
    public lua_setallocf: (L: LuaState, f: number, ud: number) => void;
    public lua_setfenv: (L: LuaState, idx: number) => number;
    public lua_setfield: (L: LuaState, idx: number, k: string | null) => void;

    public lua_sethook: (L: LuaState, func: number | null, mask: number, count: number) => void;
    public lua_setlocal: (L: LuaState, ar: number | null, n: number) => string;
    public lua_setmetatable: (L: LuaState, objindex: number) => number;
    public lua_settable: (L: LuaState, idx: number) => void;
    public lua_settop: (L: LuaState, idx: number) => void;
    public lua_setupvalue: (L: LuaState, funcindex: number, n: number) => string;
    public lua_status: (L: LuaState) => number;

    public lua_type: (L: LuaState, idx: number) => LuaType;
    public lua_typename: (L: LuaState, tp: number) => string;
    public lua_xmove: (from: LuaState, to: LuaState, n: number) => void;
    public lua_yield: (L: LuaState, nresults: number) => number;

    public luaopen_base: (L: LuaState) => SVGAnimatedNumberList;
    public luaopen_table: (L: LuaState) => number;
    public luaopen_io: (L: LuaState) => number;
    public luaopen_os: (L: LuaState) => number;
    public luaopen_string: (L: LuaState) => number;
    public luaopen_math: (L: LuaState) => number;
    public luaopen_debug: (L: LuaState) => number;
    public luaopen_package: (L: LuaState) => number;

    public referenceTracker = new WeakMap<any, ReferenceMetadata>();
    public referenceMap = new Map<number, any>();
    public availableReferences: number[] = [];
    public lastRefIndex?: number;

    constructor(module: LuaEmscriptenModule) {
        this.module = module;
        this.luaL_error = this.cwrap('luaL_error', null, ['number', 'string']);
        this.luaL_argerror = this.cwrap('luaL_argerror', 'number', ['number', 'number', 'string']);
        this.luaL_typerror = this.cwrap('luaL_typerror', 'number', ['number', 'number', 'string']);

        this.luaL_addlstring = this.cwrap('luaL_addlstring', null, ['number', 'string', 'number']);
        this.luaL_addstring = this.cwrap('luaL_addstring', null, ['number', 'string']);
        this.luaL_addvalue = this.cwrap('luaL_addvalue', null, ['number']);

        this.luaL_checkany = this.cwrap('luaL_checkany', null, ['number', 'number']);
        this.luaL_checkinteger = this.cwrap('luaL_checkinteger', 'number', ['number', 'number']);
        this.luaL_checklstring = this.cwrap('luaL_checklstring', 'string', ['number', 'number', 'number']);
        this.luaL_checknumber = this.cwrap('luaL_checknumber', 'number', ['number', 'number']);
        //this.luaL_checkoption = this.cwrap('luaL_checkoption', 'number', ['number', 'number', 'string', 'array'])
        this.luaL_checkstack = this.cwrap('luaL_checkstack', null, ['number', 'number', 'string']);
        this.luaL_checktype = this.cwrap('luaL_checktype', null, ['number', 'number', 'number']);
        this.luaL_checkudata = this.cwrap('luaL_checkudata', 'number', ['number', 'number', 'string']);

        this.luaL_loadbuffer = this.cwrap('luaL_loadbuffer', 'number', ['number', 'string|number', 'number', 'string|number']);
        this.luaL_loadfile = this.cwrap('luaL_loadfile', 'number', ['number', 'string']);
        this.luaL_loadfilex = this.luaL_loadfile;
        this.luaL_loadstring = this.cwrap('luaL_loadstring', 'number', ['number', 'string']);

        this.luaL_buffinit = this.cwrap('luaL_buffinit', null, ['number', 'number']);
        this.luaL_callmeta = this.cwrap('luaL_callmeta', 'number', ['number', 'number', 'string']);
        this.luaL_getmetafield = this.cwrap('luaL_getmetafield', 'number', ['number', 'number', 'string']);
        this.luaL_gsub = this.cwrap('luaL_gsub', 'string', ['number', 'string', 'string', 'string']);
        this.luaL_newmetatable = this.cwrap('luaL_newmetatable', 'number', ['number', 'string']);
        this.luaL_newstate = this.cwrap('luaL_newstate', 'number', []);
        this.luaL_openlibs = this.cwrap('luaL_openlibs', null, ['number']);
        this.luaL_optinteger = this.cwrap('luaL_optinteger', 'number', ['number', 'number', 'number']);
        this.luaL_optlstring = this.cwrap('luaL_optlstring', 'string', ['number', 'number', 'string', 'number']);
        this.luaL_optnumber = this.cwrap('luaL_optnumber', 'number', ['number', 'number', 'number']);
        this.luaL_prepbuffer = this.cwrap('luaL_prepbuffer', 'string', ['number', 'number']);
        //this.luaL_prepbuffsize = this.luaL_prepbuffer
        this.luaL_pushresult = this.cwrap('luaL_pushresult', null, ['number']);
        this.luaL_pushresultsize = this.cwrap('luaL_pushresultsize', null, ['number', 'number']);
        this.luaL_register = this.cwrap('luaL_register', null, ['number', 'string', 'array']);
        this.luaL_ref = this.cwrap('luaL_ref', 'number', ['number', 'number']);
        this.luaL_unref = this.cwrap('luaL_unref', null, ['number', 'number', 'number']);
        this.luaL_where = this.cwrap('luaL_where', null, ['number', 'number']);

        this.lua_atpanic = this.cwrap('lua_atpanic', 'number', ['number', 'number']);
        this.lua_call = this.cwrap('lua_call', null, ['number', 'number', 'number']);
        this.lua_checkstack = this.cwrap('lua_checkstack', 'number', ['number', 'number']);
        this.lua_close = this.cwrap('lua_close', null, ['number']);
        this.lua_concat = this.cwrap('lua_concat', null, ['number', 'number']);
        this.lua_createtable = this.cwrap('lua_createtable', null, ['number', 'number', 'number']);
        this.lua_dump = this.cwrap('lua_dump', 'number', ['number', 'number', 'number', 'number']);
        this.lua_equal = this.cwrap('lua_equal', 'number', ['number', 'number', 'number']);
        this.lua_error = this.cwrap('lua_error', 'number', ['number']);
        this.lua_gc = this.cwrap('lua_gc', 'number', ['number', 'number', 'number']);
        this.lua_getallocf = this.cwrap('lua_getallocf', 'number', ['number', 'number']);
        this.lua_getfenv = this.cwrap('lua_getfenv', null, ['number', 'number']);
        this.lua_getfield = this.cwrap('lua_getfield', null, ['number', 'number', 'string']);
        this.lua_gethook = this.cwrap('lua_gethook', 'number', ['number']);
        this.lua_gethookcount = this.cwrap('lua_gethookcount', 'number', ['number']);
        this.lua_gethookmask = this.cwrap('lua_gethookmask', 'number', ['number']);
        this.lua_getinfo = this.cwrap('lua_getinfo', 'number', ['number', 'string', 'number']);
        this.lua_getlocal = this.cwrap('lua_getlocal', 'string', ['number', 'number', 'number']);
        this.lua_getmetatable = this.cwrap('lua_getmetatable', 'number', ['number', 'number']);
        this.lua_getstack = this.cwrap('lua_getstack', 'number', ['number', 'number', 'number']);
        this.lua_gettable = this.cwrap('lua_gettable', 'number', ['number', 'number']);
        this.lua_gettop = this.cwrap('lua_gettop', 'number', ['number']);
        this.lua_getupvalue = this.cwrap('lua_getupvalue', 'string', ['number', 'number', 'number']);
        this.lua_insert = this.cwrap('lua_insert', null, ['number', 'number']);

        this.lua_lessthan = this.cwrap('lua_lessthan', 'number', ['number', 'number', 'number']);
        this.lua_load = this.cwrap('lua_load', 'number', ['number', 'number', 'number', 'string', 'string']);
        this.lua_newstate = this.cwrap('lua_newstate', 'number', ['number', 'number']);
        this.lua_newthread = this.cwrap('lua_newthread', 'number', ['number']);
        this.lua_newuserdata = this.cwrap('lua_newuserdata', 'number', ['number', 'number']);
        this.lua_next = this.cwrap('lua_next', 'number', ['number', 'number']);
        this.lua_objlen = this.cwrap('lua_objlen', 'number', ['number', 'number']);
        this.lua_pcall = this.cwrap('lua_pcall', 'number', ['number', 'number', 'number', 'number']);

        this.lua_iscfunction = this.cwrap('lua_iscfunction', 'number', ['number', 'number']);
        this.lua_isnumber = this.cwrap('lua_isnumber', 'number', ['number', 'number']);
        this.lua_isstring = this.cwrap('lua_isstring', 'number', ['number', 'number']);
        this.lua_isuserdata = this.cwrap('lua_isuserdata', 'number', ['number', 'number']);

        this.lua_pushboolean = this.cwrap('lua_pushboolean', null, ['number', 'number']);
        this.lua_pushcclosure = this.cwrap('lua_pushcclosure', null, ['number', 'number', 'number']);
        this.lua_pushcfunction = (...args) => this.lua_pushcclosure(...args, 0);
        this.lua_pushfstring = this.cwrap('lua_pushfstring', 'string', ['number', 'string', 'array']);
        this.lua_pushinteger = this.cwrap('lua_pushinteger', null, ['number', 'number']);
        this.lua_pushlightuserdata = this.cwrap('lua_pushlightuserdata', null, ['number', 'number']);
        this.lua_pushnil = this.cwrap('lua_pushnil', null, ['number']);
        this.lua_pushnumber = this.cwrap('lua_pushnumber', null, ['number', 'number']);
        this.lua_pushlstring = this.cwrap('lua_pushlstring', null, ['number', 'string|number', 'number']);
        this.lua_pushstring = this.cwrap('lua_pushstring', null, ['number', 'string|number']);
        this.lua_pushthread = this.cwrap('lua_pushthread', 'number', ['number']);
        this.lua_pushvalue = this.cwrap('lua_pushvalue', null, ['number', 'number']);
        this.lua_pushvfstring = this.cwrap('lua_pushvfstring', 'string', ['number', 'string', 'number']);

        this.lua_toboolean = this.cwrap('lua_toboolean', 'number', ['number', 'number']);
        this.lua_tocfunction = this.cwrap('lua_tocfunction', 'number', ['number', 'number']);
        this.lua_tointeger = this.cwrap('lua_tointeger', 'number', ['number', 'number']);
        this.lua_tolstring = this.cwrap('lua_tolstring', 'string', ['number', 'number', 'number']);
        this.lua_tostring = (...args) => this.lua_tolstring(...args, null);
        this.lua_tonumber = this.cwrap('lua_tonumber', 'number', ['number', 'number']);
        this.lua_topointer = this.cwrap('lua_topointer', 'number', ['number', 'number']);
        this.lua_tothread = this.cwrap('lua_tothread', 'number', ['number', 'number']);
        this.lua_touserdata = this.cwrap('lua_touserdata', 'number', ['number', 'number']);

        this.lua_rawequal = this.cwrap('lua_rawequal', 'number', ['number', 'number', 'number']);
        this.lua_rawget = this.cwrap('lua_rawget', 'number', ['number', 'number']);
        this.lua_rawgeti = this.cwrap('lua_rawgeti', 'number', ['number', 'number', 'number']);
        this.lua_rawset = this.cwrap('lua_rawset', null, ['number', 'number']);
        this.lua_rawseti = this.cwrap('lua_rawseti', null, ['number', 'number', 'number']);
        this.lua_remove = this.cwrap('lua_remove', null, ['number', 'number']);
        this.lua_replace = this.cwrap('lua_replace', null, ['number', 'number']);
        this.lua_resume = this.cwrap('lua_resume', 'number', ['number', 'number']);
        this.lua_setallocf = this.cwrap('lua_setallocf', null, ['number', 'number', 'number']);
        this.lua_setfenv = this.cwrap('lua_setfenv', 'number', ['number', 'number']);
        this.lua_setfield = this.cwrap('lua_setfield', null, ['number', 'number', 'string']);
        this.lua_sethook = this.cwrap('lua_sethook', null, ['number', 'number', 'number', 'number']);
        this.lua_setlocal = this.cwrap('lua_setlocal', 'string', ['number', 'number', 'number']);
        this.lua_setmetatable = this.cwrap('lua_setmetatable', 'number', ['number', 'number']);
        this.lua_settable = this.cwrap('lua_settable', null, ['number', 'number']);
        this.lua_settop = this.cwrap('lua_settop', null, ['number', 'number']);
        this.lua_setupvalue = this.cwrap('lua_setupvalue', 'string', ['number', 'number', 'number']);
        this.lua_status = this.cwrap('lua_status', 'number', ['number']);

        this.lua_type = this.cwrap('lua_type', 'number', ['number', 'number']);
        this.lua_typename = this.cwrap('lua_typename', 'string', ['number', 'number']);
        this.lua_xmove = this.cwrap('lua_xmove', null, ['number', 'number', 'number']);
        this.lua_yield = this.cwrap('lua_yield', 'number', ['number', 'number']);

        this.luaopen_base = this.cwrap('luaopen_base', 'number', ['number']);
        this.luaopen_table = this.cwrap('luaopen_table', 'number', ['number']);
        this.luaopen_io = this.cwrap('luaopen_io', 'number', ['number']);
        this.luaopen_os = this.cwrap('luaopen_os', 'number', ['number']);
        this.luaopen_string = this.cwrap('luaopen_string', 'number', ['number']);
        this.luaopen_math = this.cwrap('luaopen_math', 'number', ['number']);
        this.luaopen_debug = this.cwrap('luaopen_debug', 'number', ['number']);
        this.luaopen_package = this.cwrap('luaopen_package', 'number', ['number']);
    }

    public lua_absindex(L: LuaState, idx: number): number {
        return idx > 0 || idx <= LUA_REGISTRYINDEX ? idx : this.lua_gettop(L) + idx + 1;
    }

    public lua_setglobal(L: LuaState, name: string | null): void {
        this.lua_setfield(L, LUA_GLOBALSINDEX, name);
    }

    public lua_getglobal(L: LuaState, name: string | null): LuaType {
        this.lua_getfield(L, LUA_GLOBALSINDEX, name);
        return this.lua_type(L, -1);
    }

    public lua_pop(L: LuaState, n: number): void {
        this.lua_settop(L, -n - 1);
    }

    public luaL_getmetatable(L: LuaState, tname: string | null): LuaType {
        this.lua_getfield(L, LUA_REGISTRYINDEX, tname);
        return this.lua_type(L, -1);
    }

    public luaL_typename(L: LuaState, idx: number): string {
        return this.lua_typename(L, this.lua_type(L, idx));
    }

    // 5.1没有这个
    public luaL_tolstring(L: LuaState, idx: number): string {
        idx = this.lua_absindex(L, idx);
        let result;
        if (this.luaL_callmeta(L, idx, '__tostring')) {
            if (!this.lua_isstring(L, -1)) {
                this.luaL_error(L, "'__tostring' must return a string");
            }
            result = this.luaL_tolstring(L, -1);
        } else {
            const type = this.lua_type(L, idx);
            if (type === LuaType.Number) {
                result = `${this.lua_tonumber(L, idx)}`;
            } else if (type === LuaType.String) {
                result = this.lua_tostring(L, idx);
            } else if (type === LuaType.Boolean) {
                result = this.lua_toboolean(L, idx) ? 'true' : 'false';
            } else if (type === LuaType.Nil) {
                result = 'nil';
            } else {
                const tt = this.luaL_getmetafield(L, idx, '__name'); // try name
                const kind = tt === LuaType.String ? this.lua_tostring(L, -1) : this.luaL_typename(L, idx);
                if (tt !== LuaType.Nil) {
                    this.lua_remove(L, -2); // remove '__name' if pushed
                }
                result = `${kind}: 0x${this.lua_topointer(L, idx).toString(16)}`;
            }
        }
        this.lua_pushstring(L, result);
        return result;
    }

    public lua_upvalueindex(index: number): number {
        return LUA_GLOBALSINDEX - index;
    }

    public ref(data: unknown): number {
        const existing = this.referenceTracker.get(data);
        if (existing) {
            existing.refCount++;
            return existing.index;
        }

        const availableIndex = this.availableReferences.pop();
        // +1 so the index is always truthy and not a "nullptr".
        const index = availableIndex === undefined ? this.referenceMap.size + 1 : availableIndex;
        this.referenceMap.set(index, data);
        this.referenceTracker.set(data, {
            refCount: 1,
            index,
        });

        this.lastRefIndex = index;

        return index;
    }

    public unref(index: number): void {
        const ref = this.referenceMap.get(index);
        if (ref === undefined) {
            return;
        }
        const metadata = this.referenceTracker.get(ref);
        if (metadata === undefined) {
            this.referenceTracker.delete(ref);
            this.availableReferences.push(index);
            return;
        }

        metadata.refCount--;
        if (metadata.refCount <= 0) {
            this.referenceTracker.delete(ref);
            this.referenceMap.delete(index);
            this.availableReferences.push(index);
        }
    }

    public getRef(index: number): any | undefined {
        return this.referenceMap.get(index);
    }

    public getLastRefIndex(): number | undefined {
        return this.lastRefIndex;
    }

    public printRefs(): void {
        for (const [key, value] of this.referenceMap.entries()) {
            console.log(key, value);
        }
    }

    private cwrap(
        name: string,
        returnType: Emscripten.JSType | null,
        argTypes: Array<Emscripten.JSType | 'string|number'>,
    ): (...args: any[]) => any {
        // optimization for common case
        const commonType = ['number', 'string', 'array', 'boolean'];
        const isCommonCase = argTypes.every((argType) => commonType.includes(argType as string));
        // 没有自定义类型的直接返回函数，少一层函数调用
        if (isCommonCase) {
            return (...args: any[]) => {
                return this.module.ccall(name, returnType, argTypes as Emscripten.JSType[], args as Emscripten.TypeCompatibleWithC[]);
            };
        }
        // 有自定义类型的，需要处理一下
        return (...args: any[]) => {
            const pointersToBeFreed: number[] = [];
            // allow extra arguments
            const resolvedArgTypes: Emscripten.JSType[] = [];
            const resolvedArgs: Emscripten.TypeCompatibleWithC[] = [];
            argTypes.forEach((argType, i) => {
                if (commonType.includes(argType)) {
                    resolvedArgTypes.push(argType as Emscripten.JSType);
                    resolvedArgs.push(args[i] as Emscripten.TypeCompatibleWithC);
                } else if (argType === 'string|number') {
                    if (typeof args[i] === 'number') {
                        resolvedArgTypes.push('number');
                        resolvedArgs.push(args[i] as Emscripten.TypeCompatibleWithC);
                    } else {
                        // because it will be freed later, this can only be used on functions that lua internally copies the string
                        if (args[i]?.length > 1024) {
                            const bufferPointer = this.module.stringToNewUTF8(args[i] as string);
                            resolvedArgTypes.push('number');
                            resolvedArgs.push(bufferPointer);
                            pointersToBeFreed.push(bufferPointer);
                        } else {
                            resolvedArgTypes.push('string');
                            resolvedArgs.push(args[i] as Emscripten.TypeCompatibleWithC);
                        }
                    }
                }
            });
            try {
                return this.module.ccall(name, returnType, resolvedArgTypes, resolvedArgs);
            } finally {
                for (const pointer of pointersToBeFreed) {
                    this.module._free(pointer);
                }
            }
        };
    }
}
