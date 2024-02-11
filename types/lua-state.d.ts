declare type LuaState = number;

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

declare interface LuaContext {
    [key: string]: any;
}

declare interface PushValueOptions {
    refs?: Map<any, number>;
    metatable?: Record<string, any>;
}

declare interface GetValueOptions {
    refs?: Map<number, any>;
    type?: LuaType;

    // used for table
    dictType?: DictType;
}

declare interface LuaMemoryStats {
    memoryUsed: number;
    memoryMax?: number;
}

declare interface JsTypeDefinition {
    name: string;
    match: (value: any) => boolean;
    push_metatable: () => boolean;
}
