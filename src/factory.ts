import { EnvironmentVariables } from './types'
import LuaApi from './lua-api'
import LuaEngine from './engine'
// A rollup plugin will resolve this to the current version on package.json
import version from 'package-version'

export default class LuaFactory {
    private luaApiPromise: Promise<LuaApi>

    public constructor(customWasmUri?: string, environmentVariables?: EnvironmentVariables) {
        if (customWasmUri === undefined) {
            const isBrowser =
                (typeof window === 'object' && typeof window.document !== 'undefined') ||
                (typeof self === 'object' && self?.constructor?.name === 'DedicatedWorkerGlobalScope')

            if (isBrowser) {
                customWasmUri = `https://unpkg.com/wasmoon-lua5.1@${version}/dist/lua.wasm`
            }
        }

        this.luaApiPromise = LuaApi.initialize(customWasmUri, environmentVariables)
    }

    public async mountFile(path: string, content: string | ArrayBufferView): Promise<void> {
        this.mountFileSync(await this.getLuaModule(), path, content)
    }

    public mountFileSync(luaApi: LuaApi, path: string, content: string | ArrayBufferView): void {
        const fileSep = path.lastIndexOf('/')
        const file = path.substring(fileSep + 1)
        const body = path.substring(0, path.length - file.length - 1)

        if (body.length > 0) {
            const parts = body.split('/').reverse()
            let parent = ''

            while (parts.length) {
                const part = parts.pop()
                if (!part) {
                    continue
                }

                const current = `${parent}/${part}`
                try {
                    luaApi.module.FS.mkdir(current)
                } catch (err) {
                    // ignore EEXIST
                }

                parent = current
            }
        }

        luaApi.module.FS.writeFile(path, content)
    }

    public async createEngine(options: ConstructorParameters<typeof LuaEngine>[1] = {}): Promise<LuaEngine> {
        return new LuaEngine(await this.getLuaModule(), options)
    }

    public async getLuaModule(): Promise<LuaApi> {
        return this.luaApiPromise
    }
}
