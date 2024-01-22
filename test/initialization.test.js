const { Lua } = require('..');

describe('Initialization', () => {
    it('create engine should succeed', async () => {
        await Lua.create();
    });

    it('create engine with options should succeed', async () => {
        await Lua.create({
            openStandardLibs: true,
            traceAllocations: true,
        });
    });
});
