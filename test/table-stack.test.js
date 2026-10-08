// 验证读取非栈顶表时引用正确，并保持 Lua 栈与真实返回类型。
const { expect } = require('chai');
const { Lua, DictType } = require('../dist');

describe('table stack references', () => {
    it('reads a lower stack table without consuming or aliasing the top value', async () => {
        const lua = await Lua.create();
        try {
            lua.global.pushValue({ value: 42 });
            lua.global.pushValue({ value: 7 });
            const top = lua.global.getTop();
            const table = lua.global.getTable(-2);
            expect(table.value).to.equal(42);
            expect(lua.global.getTop()).to.equal(top);
            expect(lua.global.getTable(-1).value).to.equal(7);
            expect(table.$detach(DictType.Object)).to.deep.equal({ value: 42 });
        } finally {
            lua.global.close();
        }
    });
});
