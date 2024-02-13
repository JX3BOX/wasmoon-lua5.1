import { LUA_IDSIZE } from './definitions';

interface LuaDebugTraceback {
    event: number;
    name: string;
    namewhat: string;
    what: string;
    source: string;
    currentline: number | '?';
    nups: number;
    linedefined: number | '?';
    lastlinedefined: number | '?';
    short_src: string;
    i_ci: number;
}

export class LuaDebug {
    public static readonly structSize = 100;
    private pointer: number;
    private module: LuaEmscriptenModule;
    private tracebacks: LuaDebugTraceback[] = [];
    private message: string;

    constructor(pointer: number, module: LuaEmscriptenModule, message: string) {
        this.pointer = pointer;
        this.module = module;
        this.message = message;
    }

    public read(): void {
        let baseIndex = this.pointer >> 2;
        const event = this.module.HEAPU32.at(baseIndex++) as number;
        const name = this.readStructString(baseIndex++);
        const namewhat = this.readStructString(baseIndex++);
        const what = this.readStructString(baseIndex++);
        const source = this.readStructString(baseIndex++);
        const currentline = this.module.HEAPU32.at(baseIndex++) as number;
        const nups = this.module.HEAPU32.at(baseIndex++) as number;
        const linedefined = this.module.HEAPU32.at(baseIndex++) as number;
        const lastlinedefined = this.module.HEAPU32.at(baseIndex++) as number;
        const short_src = this.module.UTF8ToString(baseIndex << 2, 60);
        const i_ci = this.module.HEAPU32.at(baseIndex + LUA_IDSIZE / 4) as number;

        const traceback: LuaDebugTraceback = {
            event,
            name: name || '?',
            namewhat,
            what,
            source,
            currentline: currentline === 0xffffffff ? '?' : currentline,
            nups,
            linedefined: linedefined === 0xffffffff ? '?' : linedefined,
            lastlinedefined: lastlinedefined === 0xffffffff ? '?' : lastlinedefined,
            short_src,
            i_ci,
        };
        this.tracebacks.push(traceback);
    }

    public getMessage(): string {
        const result: string[] = [];
        result.push(`${this.tracebacks[0]?.short_src || '?'}:${this.tracebacks[0]?.currentline || '?'}: ${this.message}`);
        if (this.tracebacks.length) {
            result.push('stack traceback:');
        }
        for (const traceback of this.tracebacks) {
            result.push(
                `    at ${traceback.name} (${traceback.short_src}:${traceback.currentline}) (${traceback.what}:${traceback.namewhat})`,
            );
        }
        return result.join('\n');
    }

    public getTracebacks(): LuaDebugTraceback[] {
        return this.tracebacks;
    }

    private readStructString(structPointer: number): string {
        return this.module.UTF8ToString(this.module.HEAPU32.at(structPointer) as number);
    }
}
