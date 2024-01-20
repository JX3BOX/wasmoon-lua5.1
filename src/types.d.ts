declare module '*.wasm' {
    const value: string;
    export default value;
}

declare module '*.js';

declare module 'package-version' {
    const value: string;
    export default value;
}

declare interface LuaCreateOptions {
    customWasmUri?: string;
    environmentVariables?: EnvironmentVariables;
    openStandardLibs?: boolean | undefined;
    traceAllocations?: boolean;
}

declare interface LuaResumeResult {
    result: LuaReturn;
    resultCount: number;
}

declare interface LuaThreadRunOptions {
    timeout?: number;
}

declare type LuaState = number;

declare type EnvironmentVariables = Record<string, string | undefined>;

declare interface LuaContext {
    [key: string]: any;
}

declare interface JsTypeDefinition {
    name: string;
    match: (value: any) => boolean;
    push_metatable: () => boolean;
}
