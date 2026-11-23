// 覆盖栈平衡、协程/表/函数生命周期、大整数与元表边界回归。
const { expect } = require('chai');
const { Lua, DictType, JsType } = require('../dist');

describe('VM stability and lifecycle regressions', () => {
    it('keeps the global stack balanced across repeated doString and doFile calls', async () => {
        const lua = await Lua.create();
        try {
            lua.mountFile('/echo.lua', 'return 10, 20');
            const topBefore = lua.global.getTop();
            for (let i = 0; i < 200; i++) {
                expect(await lua.doString(`return ${i}, ${i + 1}`)).to.equal(i);
                expect(await lua.doFile('/echo.lua')).to.equal(10);
            }
            expect(lua.global.getTop()).to.equal(topBefore);
        } finally {
            lua.global.close();
        }
    });

    it('handles concurrent async doString calls finishing out of order without stack corruption', async () => {
        const lua = await Lua.create();
        try {
            lua.bindAsync(
                'delay',
                (ms, value) =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve(value), ms);
                    }),
            );
            const topBefore = lua.global.getTop();
            const slow = lua.doString('return delay(25, "slow")');
            const fast = lua.doString('return delay(5, "fast")');
            const [slowResult, fastResult] = await Promise.all([slow, fast]);
            expect(slowResult).to.equal('slow');
            expect(fastResult).to.equal('fast');
            expect(lua.global.getTop()).to.equal(topBefore);
        } finally {
            lua.global.close();
        }
    });

    it('keeps the global stack balanced across sync calls and error paths', async () => {
        const lua = await Lua.create();
        try {
            lua.mountFile('/sync.lua', 'return 7, 8');
            lua.doStringSync('function pair(a, b) return a + b, a - b end');
            const topBefore = lua.global.getTop();

            for (let i = 0; i < 100; i++) {
                expect(lua.doStringSync(`return ${i}, ${i + 1}`)).to.equal(i);
                expect(lua.doFileSync('/sync.lua')).to.equal(7);
                expect(lua.global.call('pair', i, 1)).to.deep.equal([i + 1, i - 1]);
            }

            expect(() => lua.doStringSync('x -')).to.throw();
            expect(() => lua.doStringSync('error("boom")')).to.throw('boom');
            expect(() => lua.doFileSync('/missing.lua')).to.throw();
            expect(() => lua.global.call('missing_fn')).to.throw();
            expect(lua.global.getTop()).to.equal(topBefore);
        } finally {
            lua.global.close();
        }
    });

    it('keeps returned tables and functions usable after temporary coroutine GC and supports idempotent destroy', async () => {
        const lua = await Lua.create();
        try {
            const table = await lua.doString('return { alive = true, ref = 123, pointer = "ok", thread = 9 }');
            const fn = await lua.doString('return function(x) return x * 2 end');

            // 触发多次完整 GC，确保创建它们的临时协程已被回收。
            await lua.doString('collectgarbage("collect"); collectgarbage("collect")');

            expect(table.alive).to.equal(true);
            expect(table.ref).to.equal(123);
            expect(table.pointer).to.equal('ok');
            expect(table.thread).to.equal(9);
            expect(Object.prototype.toString.call(table)).to.equal('[object LuaTable]');

            const refsBeforeSet = lua.luaApi.pointerRefs.size;
            table.nested = { value: 42 };
            expect(lua.luaApi.pointerRefs.size).to.equal(refsBeforeSet);
            expect(table.$detach(DictType.Object)).to.deep.equal({
                alive: true,
                ref: 123,
                pointer: 'ok',
                thread: 9,
                nested: { value: 42 },
            });

            expect(fn(21)).to.equal(42);
            table.$destroy();
            expect(table.$isAlive()).to.equal(false);
            table.$destroy();
            expect(() => table.alive).to.throw('is destroyed');
            fn.$destroy();
            expect(fn.$isAlive()).to.equal(false);
            fn.$destroy();
            expect(() => fn(1)).to.throw('destroyed');
            expect(await lua.doString('return 99')).to.equal(99);
        } finally {
            lua.global.close();
        }
    });

    it('does not leak registry refs on repeated getFunction cache hits', async () => {
        const lua = await Lua.create();
        try {
            await lua.doString('function reusable(x) return x + 1 end');
            const first = lua.ctx.reusable;
            const registryLenBefore = await lua.doString('return #debug.getregistry()');
            for (let i = 0; i < 200; i++) {
                expect(lua.ctx.reusable).to.equal(first);
            }
            const registryLenAfter = await lua.doString('return #debug.getregistry()');
            expect(registryLenAfter).to.equal(registryLenBefore);
        } finally {
            lua.global.close();
        }
    });

    it('preserves circular and shared references in nested JS tables without corrupting the registry', async () => {
        const lua = await Lua.create();
        try {
            const shared = { tag: 'shared' };
            const root = {
                a: { x: 1 },
                b: { y: 2 },
                shared1: shared,
                shared2: shared,
            };
            root.self = root;

            lua.ctx.graph = root;
            const ok = await lua.doString(`
                assert(graph.a.x == 1)
                assert(graph.b.y == 2)
                assert(graph.shared1 == graph.shared2)
                assert(graph.shared1.tag == "shared")
                assert(graph.self == graph)
                return true
            `);
            expect(ok).to.equal(true);
            expect(lua.global.getTop()).to.equal(0);
        } finally {
            lua.global.close();
        }
    });

    it('pushes integers outside 32-bit signed range without truncation', async () => {
        const lua = await Lua.create();
        try {
            const values = [1689031554550, -3000000000, 2 ** 40];
            for (const value of values) {
                lua.ctx.bigNum = value;
                expect(await lua.doString('return bigNum')).to.equal(value);
                expect(await lua.doString('return tostring(bigNum)')).to.equal(String(value));
            }
        } finally {
            lua.global.close();
        }
    });

    it('handles tostring and indexing on plain Lua functions after binding JS functions, and cleans up GC redirects', async () => {
        const lua = await Lua.create();
        try {
            lua.ctx.jsFn = () => 1;
            const str = await lua.doString('return tostring(function() end)');
            expect(str).to.match(/^function: 0x[0-9a-f]+$/);

            const indexed = await lua.doString(`
                local ok, err = pcall(function()
                    local f = function() end
                    return f.foo
                end)
                assert(ok == false)
                return tostring(err)
            `);
            expect(indexed).to.include('attempt to index a function value');

            await lua.doString('jsFn = nil; collectgarbage("collect"); collectgarbage("collect")');
            expect(lua.funcManager.pointerRedirect.size).to.equal(0);
            expect(lua.funcManager.indexMap.size).to.equal(0);
        } finally {
            lua.global.close();
        }
    });

    it('releases timeout hook function pointers and respects updated timeout deadlines', async () => {
        const lua = await Lua.create();
        try {
            let added = 0;
            let removed = 0;
            const origAdd = lua.luaApi.module.addFunction.bind(lua.luaApi.module);
            const origRemove = lua.luaApi.module.removeFunction.bind(lua.luaApi.module);
            lua.luaApi.module.addFunction = (...args) => {
                added++;
                return origAdd(...args);
            };
            lua.luaApi.module.removeFunction = (...args) => {
                removed++;
                return origRemove(...args);
            };

            for (let i = 0; i < 5; i++) {
                const thread = lua.global.newThread();
                const threadRef = lua.luaApi.luaL_ref(lua.global.address, -10000);
                try {
                    thread.loadString('local s = 0; for j = 1, 2000 do s = s + j end; return s');
                    const res = await thread.run(0, { timeout: 500 });
                    expect(res[0]).to.equal(2001000);
                } finally {
                    thread.close();
                    lua.luaApi.luaL_unref(lua.global.address, -10000, threadRef);
                }
            }
            expect(added).to.equal(5);
            expect(removed).to.equal(5);

            // 更新已激活的超时时间时应读取最新 deadline，而非旧闭包值。
            const thread = lua.global.newThread();
            const threadRef = lua.luaApi.luaL_ref(lua.global.address, -10000);
            try {
                thread.setTimeout(Date.now() + 1);
                await new Promise((resolve) => setTimeout(resolve, 10));
                thread.setTimeout(Date.now() + 5000);
                thread.loadString('local s = 0; for j = 1, 5000 do s = s + j end; return s');
                const res = await thread.run(0);
                expect(res[0]).to.equal(12502500);
            } finally {
                thread.close();
                lua.luaApi.luaL_unref(lua.global.address, -10000, threadRef);
            }
            expect(removed).to.equal(added);
        } finally {
            lua.global.close();
        }
    });

    it('keeps the stack balanced in luaL_tolstring for __tostring and __name metatables', async () => {
        const lua = await Lua.create();
        try {
            await lua.doString(`
                tWithToString = setmetatable({}, { __tostring = function() return "custom-str" end })
                tWithName = setmetatable({}, { __name = "CustomType" })
            `);
            lua.global.pushValue('sentinel');
            lua.luaApi.lua_getglobal(lua.global.address, 'tWithToString');
            lua.luaApi.lua_getglobal(lua.global.address, 'tWithName');
            const topBefore = lua.global.getTop();

            expect(lua.global.indexToString(-2)).to.equal('custom-str');
            expect(lua.global.indexToString(-1)).to.match(/^CustomType: 0x[0-9a-f]+$/);
            expect(lua.global.getTop()).to.equal(topBefore);
            expect(lua.global.getValue(1)).to.equal('sentinel');
            lua.global.setTop(0);
        } finally {
            lua.global.close();
        }
    });

    it('supports in operator on lua.ctx accurately without leaking table refs and supports concat operation', async () => {
        const lua = await Lua.create();
        try {
            expect('unsetGlobal' in lua.ctx).to.equal(false);
            await lua.doString('setGlobal = { x = 1 }');
            const refsBefore = lua.luaApi.pointerRefs.size;
            expect('setGlobal' in lua.ctx).to.equal(true);
            expect(lua.luaApi.pointerRefs.size).to.equal(refsBefore);

            const val = JsType.decorate({ text: 'hi' }).operation('concat', (a, b) => `${a.text}:${b}`);
            lua.ctx.concatObj = val;
            expect(await lua.doString('return concatObj .. "!"')).to.equal('hi:!');
        } finally {
            lua.global.close();
        }
    });
});
