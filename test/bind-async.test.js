const { expect } = require('chai');
const { Lua } = require('../dist');

describe('async JS bindings', () => {
    let lua;
    beforeEach(async () => {
        lua = await Lua.create();
    });
    afterEach(() => lua.global.close());

    it('resumes the same coroutine and preserves locals without repeating side effects', async () => {
        let calls = 0;
        lua.ctx.effect = () => {
            calls++;
        };
        lua.bindAsync('fetchValue', async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            return value + 1;
        });
        expect(
            await lua.doString(`
            local thread = coroutine.running()
            effect()
            local first = fetchValue(20)
            local second = fetchValue(first)
            assert(thread == coroutine.running())
            return first + second
        `),
        ).to.equal(43);
        expect(calls).to.equal(1);
    });

    it('supports synchronous results, nil and table values', async () => {
        lua.bindAsync('nothing', () => undefined);
        lua.bindAsync('values', () => [4, 7]);
        expect(await lua.doString('assert(nothing() == nil); local t=values(); return t[0]+t[1]')).to.equal(11);
    });

    it('raises rejected promises and synchronous throws in Lua after resume', async () => {
        lua.bindAsync('failure', () => Promise.reject(new Error('fetch failed')));
        await expect(lua.doString('failure()')).to.be.rejectedWith('fetch failed');
        lua.bindAsync('failure', () => {
            throw new Error('synchronous failure');
        });
        await expect(lua.doString('failure()')).to.be.rejectedWith('synchronous failure');
        expect(await lua.doString('return 42')).to.equal(42);
    });
});
