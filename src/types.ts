// 定义公开的 Lua 运行与转换选项；随入口打包，不向调用方注入全局类型。
import type { DictType } from './utils/map-transform';
import type { LuaReturn, LuaType } from './definitions';

export type EnvironmentVariables = Record<string, string | undefined>;

export type CType = 'number' | 'string' | 'array' | 'boolean';
export type CValue = number | string | any[] | boolean;

/** 本库导出并使用的 Emscripten 运行时接口，不依赖全局 @types/emscripten。 */
export interface LuaEmscriptenModule {
    HEAPU32: Uint32Array;
    ENV: EnvironmentVariables;
    FS: {
        mkdir(path: string, mode?: number): void;
        writeFile(path: string, data: string | ArrayBufferView): void;
        readFile(path: string, options?: { encoding?: 'binary' }): Uint8Array;
        readFile(path: string, options: { encoding: 'utf8' }): string;
        readdir(path: string): string[];
        unlink(path: string): void;
    };

    ccall(name: string, result: CType | null, types: CType[], args: CValue[]): any;
    addFunction(callback: (...args: any[]) => any, signature?: string): number;
    removeFunction(pointer: number): void;
    getValue(pointer: number, type: string): number;
    setValue(pointer: number, value: number, type: string): void;
    stringToNewUTF8(value: string): number;
    lengthBytesUTF8(value: string): number;
    stringToUTF8(value: string, pointer: number, size: number): void;
    UTF8ToString(pointer: number, size?: number): string;
    _malloc(size: number): number;
    _realloc(pointer: number, size: number): number;
    _free(pointer: number): void;
}

export interface ReferenceMetadata {
    index: number;
    refCount: number;
}

export type LuaState = number;

export interface LuaCreateOptions {
    customWasmUri?: string;
    environmentVariables?: EnvironmentVariables;
    openStandardLibs?: boolean | undefined;
    traceAllocations?: boolean;
}

export interface LuaResumeResult {
    result: LuaReturn;
    resultCount: number;
}

export interface LuaThreadRunOptions {
    timeout?: number;
}

export interface LuaContext {
    [key: string]: any;
}

export interface PushValueOptions {
    refs?: Map<any, number>;
    metatable?: Record<string, any>;
}

export interface GetValueOptions {
    refs?: Map<number, any>;
    type?: LuaType;

    // used for table
    dictType?: DictType;
}

export interface LuaMemoryStats {
    memoryUsed: number;
    memoryMax?: number;
}
