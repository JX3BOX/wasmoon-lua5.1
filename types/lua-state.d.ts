import { DictType } from './../src/utils/map-transform';

declare global {
    type LuaState = number;

    interface LuaCreateOptions {
        customWasmUri?: string;
        environmentVariables?: EnvironmentVariables;
        openStandardLibs?: boolean | undefined;
        traceAllocations?: boolean;
    }

    interface LuaResumeResult {
        result: LuaReturn;
        resultCount: number;
    }

    interface LuaThreadRunOptions {
        timeout?: number;
    }

    interface LuaContext {
        [key: string]: any;
    }

    interface PushValueOptions {
        refs?: Map<any, number>;
        metatable?: Record<string, any>;
    }

    interface GetValueOptions {
        refs?: Map<number, any>;
        type?: LuaType;

        // used for table
        dictType?: DictType;
    }

    interface LuaMemoryStats {
        memoryUsed: number;
        memoryMax?: number;
    }

    interface JsTypeDefinition {
        name: string;
        match: (value: any) => boolean;
        push_metatable: () => boolean;
    }

    interface LuaTable {
        [key: any]: any;

        $get: (key: any) => any;
        $set: (key: any, value: any) => void;
        $istable: () => true;
        $getRef: () => number;
        $detach: (options?: LuaTableDetachOptions) => Map<any, any>;
    }

    interface LuaTableDetachOptions {
        dictType?: DictType;
    }
}
