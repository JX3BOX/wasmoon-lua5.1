import { LuaLibraries } from './definitions';
import LuaThread from './thread';
import type LuaApi from './api';

interface LuaMemoryStats {
    memoryUsed: number;
    memoryMax?: number;
}

export default class LuaGlobal extends LuaThread {
    private memoryStats: LuaMemoryStats | undefined;
    private allocatorFunctionPointer: number | undefined;

    public constructor(cmodule: LuaApi, shouldTraceAllocations: boolean | undefined) {
        if (shouldTraceAllocations) {
            const memoryStats: LuaMemoryStats = { memoryUsed: 0 };
            const allocatorFunctionPointer = cmodule.module.addFunction(
                (_userData: number, pointer: number, oldSize: number, newSize: number): number => {
                    if (newSize === 0) {
                        if (pointer) {
                            memoryStats.memoryUsed -= oldSize;
                            cmodule.module._free(pointer);
                        }
                        return 0;
                    }

                    const endMemoryDelta = pointer ? newSize - oldSize : newSize;
                    const endMemory = memoryStats.memoryUsed + endMemoryDelta;

                    if (newSize > oldSize && memoryStats.memoryMax && endMemory > memoryStats.memoryMax) {
                        return 0;
                    }

                    const reallocated = cmodule.module._realloc(pointer, newSize);
                    if (reallocated) {
                        memoryStats.memoryUsed = endMemory;
                    }
                    return reallocated;
                },
                'iiiii',
            );

            const address = cmodule.lua_newstate(allocatorFunctionPointer, null);
            if (!address) {
                cmodule.module.removeFunction(allocatorFunctionPointer);
                throw new Error('lua_newstate returned a null pointer');
            }
            super(cmodule, address);

            this.memoryStats = memoryStats;
            this.allocatorFunctionPointer = allocatorFunctionPointer;
        } else {
            const address = cmodule.luaL_newstate();
            super(cmodule, address);
        }

        if (this.isClosed()) {
            throw new Error('Global state could not be created (probably due to lack of memory)');
        }
    }

    public close(): void {
        if (this.isClosed()) {
            return;
        }

        super.close();

        // Do this before removing the gc to force.
        // Here rather than in the threads because you don't
        // actually close threads, just pop them. Only the top-level
        // lua state needs closing.
        this.luaApi.lua_close(this.address);

        if (this.allocatorFunctionPointer) {
            this.luaApi.module.removeFunction(this.allocatorFunctionPointer);
        }
    }

    public loadLibrary(library: LuaLibraries): void {
        switch (library) {
            case LuaLibraries.Base:
                this.luaApi.luaopen_base(this.address);
                break;
            case LuaLibraries.Table:
                this.luaApi.luaopen_table(this.address);
                break;
            case LuaLibraries.IO:
                this.luaApi.luaopen_io(this.address);
                break;
            case LuaLibraries.OS:
                this.luaApi.luaopen_os(this.address);
                break;
            case LuaLibraries.String:
                this.luaApi.luaopen_string(this.address);
                break;
            case LuaLibraries.Math:
                this.luaApi.luaopen_math(this.address);
                break;
            case LuaLibraries.Debug:
                this.luaApi.luaopen_debug(this.address);
                break;
            case LuaLibraries.Package:
                this.luaApi.luaopen_package(this.address);
                break;
        }
        this.luaApi.lua_setglobal(this.address, library);
    }

    public get(name: string): any {
        const type = this.luaApi.lua_getglobal(this.address, name);
        const value = this.getValue(-1, { type });
        this.pop();
        return value;
    }

    public set(name: string, value: unknown): void {
        this.pushValue(value);
        this.luaApi.lua_setglobal(this.address, name);
    }

    public getMemoryUsed(): number {
        return this.getMemoryStatsRef().memoryUsed;
    }

    public getMemoryMax(): number | undefined {
        return this.getMemoryStatsRef().memoryMax;
    }

    public setMemoryMax(max: number | undefined): void {
        this.getMemoryStatsRef().memoryMax = max;
    }

    private getMemoryStatsRef(): LuaMemoryStats {
        if (!this.memoryStats) {
            throw new Error('Memory allocations is not being traced, please build engine with { traceAllocations: true }');
        }

        return this.memoryStats;
    }
}
