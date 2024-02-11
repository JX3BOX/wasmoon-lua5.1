const { Lua } = require('..');
const { expect } = require('chai');

describe('Filesystem', () => {
    it('mount a file and require inside lua should succeed', async () => {
        const lua = await Lua.create();
        lua.mountFile('test.lua', 'answerToLifeTheUniverseAndEverything = 42');
        await lua.doString('require("test")');

        expect(lua.ctx.answerToLifeTheUniverseAndEverything).to.be.equal(42);
    });

    it('mount a file in a complex directory and require inside lua should succeed', async () => {
        const lua = await Lua.create();
        lua.mountFile('yolo/sofancy/test.lua', 'return 42');

        const value = await lua.doString('return require("yolo/sofancy/test")');
        expect(value).to.be.equal(42);
    });

    it('mount a init file and require the module inside lua should fail (need lua 5.2+)', async () => {
        const lua = await Lua.create();
        lua.mountFile('hello/init.lua', 'return 42');

        try {
            await lua.doString('return require("hello")');
        } catch (e) {
            expect(e.message).to.include("module 'hello' not found:");
            return;
        }
        expect.fail('Expected an error, but no error was thrown.');
    });

    it('require a file which is not mounted should throw', async () => {
        const lua = await Lua.create();

        await expect(lua.doString('require("nothing")')).to.eventually.be.rejected;
    });

    it('mount a file and run it should succeed', async () => {
        const lua = await Lua.create();
        lua.mountFile('init.lua', `return 42`);

        const value = await lua.doFile('init.lua');
        expect(value).to.be.equal(42);
    });

    it('run a file which is not mounted should throw', async () => {
        const lua = await Lua.create();

        await expect(lua.doFile('init.lua')).to.eventually.be.rejected;
    });

    it('mount a file with a large content should succeed', async () => {
        const lua = await Lua.create();
        const content = 'a'.repeat(1000000);
        lua.mountFile('init.lua', `local a = "${content}" return a`);

        const value = await lua.doFile('init.lua');
        expect(value).to.be.equal(content);
    });

    it('unmount a file and require it should throw', async () => {
        const lua = await Lua.create();
        lua.mountFile('init.lua', `return 42`);
        lua.unmountFile('init.lua');

        await expect(lua.doString('require("init")')).to.eventually.be.rejected;
    });
});
