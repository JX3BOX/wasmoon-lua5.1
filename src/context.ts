import LuaGlobal from './global';

const getContextProxy = (global: LuaGlobal): LuaContext => {
    return new Proxy(global, {
        get: (target: LuaGlobal, key) => {
            if (key === Symbol.iterator) {
                return {
                    next: () => {
                        return 1;
                    },
                };
            }
            if (typeof key === 'symbol') {
                return undefined;
            }
            return target.get(key);
        },
        set: (target: LuaGlobal, key: string, value: any) => {
            target.set(key, value);
            return true;
        },
        has: (target: LuaGlobal, key: string) => {
            return target.get(key) !== undefined;
        },
    });
};

export default getContextProxy;
