/* eslint-disable no-sparse-arrays */
const { JsType, LuaThread, LuaType, LuaReturn, DictType } = require('../dist/index');
const { expect } = require('chai');
// const { getEngine, getFactory } = require('./utils');
const { Lua } = require('..');
const { setTimeout } = require('node:timers/promises');
// const { EventEmitter } = require('events');
const jestMock = require('jest-mock');

class TestClass {
    static hello() {
        return 'world';
    }

    constructor(name) {
        this.name = name;
    }

    getName() {
        return this.name;
    }
}

describe('Engine', () => {
    let intervals = [];
    const setIntervalSafe = (callback, interval) => {
        intervals.push(setInterval(() => callback(), interval));
    };

    afterEach(() => {
        for (const interval of intervals) {
            clearInterval(interval);
        }
        intervals = [];
    });

    it('receive lua table on JS function should succeed', async () => {
        const lua = await Lua.create();
        lua.ctx.stringify = (table) => {
            return JSON.stringify(table.$detach({ dictType: 1 }));
        };

        await lua.doString('value = stringify({ test = 1 })');
        expect(lua.ctx.value).to.be.equal(JSON.stringify({ test: 1 }));
    });

    it('get a global table inside a JS function called by lua should succeed', async () => {
        const lua = await Lua.create();

        lua.ctx.t = { test: 1 };
        lua.ctx.test = () => {
            return lua.ctx.t;
        };
        const value = (await lua.doString('return test(2)')).$detach({ dictType: 1 });

        expect(value).to.be.eql({ test: 1 });
    });

    it('receive JS object on lua should succeed', async () => {
        const lua = await Lua.create();
        lua.ctx.test = () => {
            return {
                aaaa: 1,
                bbb: 'hey',
                test() {
                    return 22;
                },
            };
        };

        const value = await lua.doString('return test().test()');
        expect(value).to.be.equal(22);
    });

    it('receive JS object with circular references on lua should succeed', async () => {
        const lua = await Lua.create();
        const obj = {
            hello: 'world',
        };
        obj.self = obj;

        lua.ctx.obj = obj;

        const value = await lua.doString('return obj.self.self.self.hello');
        expect(value).to.be.equal('world');
    });

    it('receive Lua object with circular references on JS should succeed', async () => {
        const lua = await Lua.create();

        const value = lua
            .doStringSync(
                `
            local obj1 = {
                hello = 'world',
            }
            obj1.self = obj1
            local obj2 = {
                5,
                hello = 'everybody',
                array = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
                fn = function()
                    return 'hello'
                end
            }
            obj2.self = obj2
            return { obj1 = obj1, obj2 }
        `,
            )
            .$detach(DictType.Array);
        const obj = [, [, 5]];
        obj[1]['hello'] = 'everybody';
        obj[1]['array'] = [, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        obj[1]['fn'] = value[1]['fn'];
        obj['obj1'] = {
            hello: 'world',
        };
        obj['obj1'].self = obj['obj1'];
        obj[1].self = obj[1];
        expect(value).to.deep.eql(obj);
    });

    it('receive lua array with circular references on JS should succeed', async () => {
        const lua = await Lua.create();
        const value = lua
            .doStringSync(
                `
            obj = {
                "hello",
                "world"
            }
            table.insert(obj, obj)
            return obj
        `,
            )
            .$detach(DictType.Array);

        const arr = [undefined, 'hello', 'world'];
        arr.push(arr);
        expect(value).to.be.eql(arr);
    });

    it('receive JS object with multiple circular references on lua should succeed', async () => {
        const lua = await Lua.create();

        const obj1 = {
            hello: 'world',
        };
        obj1.self = obj1;
        const obj2 = {
            hello: 'everybody',
        };
        obj2.self = obj2;

        lua.ctx.obj = { obj1, obj2 };

        await lua.doString(`
            assert(obj.obj1.self.self.hello == "world")
            assert(obj.obj2.self.self.hello == "everybody")
        `);
    });

    it('receive JS object with null prototype on lua should succeed', async () => {
        const lua = await Lua.create();

        const obj = Object.create(null);
        obj.hello = 'world';

        lua.ctx.obj = obj;

        const value = await lua.doString(`return obj.hello`);
        expect(value).to.be.equal('world');
    });

    it('a lua error should throw on JS', async () => {
        const lua = await Lua.create();

        await expect(lua.doString(`x -`)).to.eventually.be.rejected;
    });

    it('call a lua function from JS should succeed', async () => {
        const lua = await Lua.create();

        await lua.doString(`function sum(x, y) return x + y end`);
        const sum = lua.ctx.sum;

        expect(sum(10, 50)).to.be.equal(60);
    });

    it('scheduled lua calls should succeed', async () => {
        const lua = await Lua.create();
        lua.ctx.setInterval = setIntervalSafe;

        await lua.doString(`
            test = ""
            setInterval(function()
                test = test .. "i"
            end, 1)
        `);
        await setTimeout(20);

        const test = lua.ctx.test;
        expect(test).length.above(3);
        expect(test).length.below(21);
        expect(test).to.be.equal(''.padEnd(test.length, 'i'));
    });

    it('scheduled lua calls should fail silently if invalid', async () => {
        const lua = await Lua.create();
        lua.ctx.setInterval = setIntervalSafe;

        // TODO: Disable mock at the end of the test.
        jestMock.spyOn(console, 'warn').mockImplementation(() => {
            // Nothing to do.
        });

        await lua.doString(`
            test = 0
            setInterval(function()
                test = test + 1
            end, 5)
        `);

        lua.global.close();

        await setTimeout(5 + 5);
    });

    it('call lua function from JS passing an array argument should succeed', async () => {
        const lua = await Lua.create();

        const sum = await lua.doString(`
            return function(arr)
                local sum = 0
                for k, v in ipairs(arr) do
                    sum = sum + v
                end
                return sum
            end
        `);

        expect(sum([undefined, 10, 50, 25])).to.be.equal(85);
    });

    it('call a global function with multiple returns should succeed', async () => {
        const lua = await Lua.create();

        await lua.doString(`
            function f(x,y)
                return 1,x,y,"Hello World",{},function() end
            end
        `);

        const returns = lua.global.call('f', 10, 25);
        expect(returns).to.have.length(6);
        expect(returns.slice(0, -2)).to.eql([1, 10, 25, 'Hello World']);
        expect(returns.at(-2).$istable()).to.eql(true);
        expect(returns.at(-1)).to.be.a('function');
    });

    it('get a lua thread should succeed', async () => {
        const lua = await Lua.create();

        const thread = await lua.doString(`
            return coroutine.create(function()
                print("hey")
            end)
        `);

        expect(thread).to.be.instanceOf(LuaThread);
        expect(thread).to.not.be.equal(0);
    });

    it('a JS error should pause lua execution', async () => {
        const lua = await Lua.create();

        const check = jestMock.fn();
        lua.ctx.check = check;
        lua.ctx.throw = () => {
            throw new Error('expected error');
        };
        await expect(
            lua.doString(`
                throw()
                check()
            `),
        ).eventually.to.be.rejected;
        expect(check.mock.calls).to.have.length(0);
    });

    it('catch a JS error with pcall should succeed', async () => {
        const lua = await Lua.create();
        const check = jestMock.fn();
        lua.ctx.check = check;
        lua.ctx.throw = () => {
            throw new Error('Error: expected error');
        };
        await lua.doString(`
            local success, err = pcall(throw)
            assert(success == false)
            assert(tostring(err) == "Error: expected error")
            check()
        `);

        expect(check.mock.calls).to.have.length(1);
    });

    it('call a JS function in a different thread should succeed', async () => {
        const lua = await Lua.create();
        const sum = jestMock.fn((x, y) => x + y);
        lua.ctx.sum = sum;

        await lua.doString(`
            coroutine.resume(coroutine.create(function()
                sum(10, 20)
            end))
        `);

        expect(sum.mock.lastCall).to.be.eql([10, 20]);
    });

    it('get callable table as function should succeed', async () => {
        const lua = await Lua.create();

        await lua.doString(`
            _G['sum'] = setmetatable({}, {
                __call = function(self, x, y)
                    return x + y
                end
            })
        `);

        lua.global.luaApi.lua_getglobal(lua.global.address, 'sum');
        const sum = lua.global.getValue(-1, { type: LuaType.Function });

        expect(sum(10, 30)).to.be.equal(40);
    });

    it('lua_resume with yield succeeds', async () => {
        const lua = await Lua.create();
        const thread = lua.global.newThread();
        thread.loadString(`
            local yieldRes = coroutine.yield(10)
            return yieldRes
        `);

        const resumeResult = thread.resume(0);
        expect(resumeResult.result).to.be.equal(LuaReturn.Yield);
        expect(resumeResult.resultCount).to.be.equal(1);

        const yieldValue = thread.getValue(-1);
        expect(yieldValue).to.be.equal(10);

        thread.pop(resumeResult.resultCount);
        thread.pushValue(yieldValue * 2);

        const finalResumeResult = thread.resume(1);
        expect(finalResumeResult.result).to.be.equal(LuaReturn.Ok);
        expect(finalResumeResult.resultCount).to.be.equal(1);

        const finalValue = thread.getValue(-1);
        expect(finalValue).to.be.equal(20);
    });

    it('get memory with allocation tracing should succeeds', async () => {
        const lua = await Lua.create({ traceAllocations: true });
        expect(lua.global.getMemoryUsed()).to.be.greaterThan(0);
    });

    it('get memory should return correct', async () => {
        const lua = await Lua.create({ traceAllocations: true });

        const totalMemory = await lua.doString(`
            collectgarbage()
            local x = 10
            local batata = { dawdwa = 1 }
            return collectgarbage('count') * 1024
        `);

        expect(lua.global.getMemoryUsed()).to.be.equal(totalMemory);
    });

    it('get memory without tracing should throw', async () => {
        const lua = await Lua.create({ traceAllocations: false });

        expect(() => lua.global.getMemoryUsed()).to.throw();
    });

    it('limit memory use causes program loading failure succeeds', async () => {
        const lua = await Lua.create({ traceAllocations: true });
        lua.global.setMemoryMax(lua.global.getMemoryUsed());
        expect(() => {
            lua.global.loadString(`
                local a = 10
                local b = 20
                return a + b
            `);
        }).to.throw('not enough memory');

        // Remove the limit and retry
        lua.global.setMemoryMax(undefined);
        lua.global.loadString(`
            local a = 10
            local b = 20
            return a + b
        `);
    });

    it('limit memory use causes program runtime failure succeeds', async () => {
        const lua = await Lua.create({ traceAllocations: true });
        lua.global.loadString(`
            local tab = {}
            for i = 1, 50, 1 do
                tab[i] = i
            end
        `);
        lua.global.setMemoryMax(lua.global.getMemoryUsed());

        await expect(lua.global.run()).to.eventually.be.rejectedWith('not enough memory');
    });

    it('table supported circular dependencies', async () => {
        const lua = await Lua.create();

        const a = { name: 'a' };
        const b = { name: 'b' };
        b.a = a;
        a.b = b;

        lua.global.pushValue(a);
        const res = lua.global.getValue(-1);

        expect(res.b.a).to.be.eql(res);
    });

    it('wrap a js object (with metatable)', async () => {
        const lua = await Lua.create();

        JsType.create('js_TestClass', (target) => target instanceof TestClass)
            .index((self, key) => {
                if (key === 'name') {
                    return self.getName();
                }
                return null;
            })
            .priority(1)
            .bind(lua.global);

        lua.ctx.TestClass = {
            create: (name) => new TestClass(name),
        };

        const res = await lua.doString(`
            local instance = TestClass.create("demo name")
            return instance.name
        `);
        expect(res).to.be.equal('demo name');
    });

    it('wrap a js object using proxy', async () => {
        const lua = await Lua.create();
        lua.ctx.TestClass = {
            create: (name) => new TestClass(name),
        };
        const res = await lua.doString(`
            local instance = TestClass.create("demo name 2")
            return instance:getName()
        `);
        expect(res).to.be.equal('demo name 2');
    });

    it('wrap a js object using proxy and apply metatable in lua', async () => {
        const lua = await Lua.create();
        lua.ctx.TestClass = {
            create: (name) => new TestClass(name),
        };
        const res = await lua.doString(`
            local instance = TestClass.create("demo name 2")

            -- Based in the simple lua classes tutotial
            local Wrapped = {}
            Wrapped.__index = Wrapped

            function Wrapped:create(name)
                local wrapped = {}
                wrapped.instance = TestClass.create(name)
                setmetatable(wrapped, Wrapped)
                return wrapped
            end

            function Wrapped:getName()
                return "wrapped: "..self.instance:getName()
            end

            local wr = Wrapped:create("demo")
            return wr:getName()
        `);
        expect(res).to.be.equal('wrapped: demo');
    });

    it('classes should be a userdata when proxied', async () => {
        const lua = await Lua.create();
        lua.ctx.obj = { TestClass };

        const testClass = await lua.doString(`
            return obj.TestClass
        `);
        expect(testClass).to.be.equal(TestClass);
    });

    // ?? TODO: Fix this test
    it('timeout blocking lua program', async () => {
        const lua = await Lua.create();
        lua.global.loadString(`
            local i = 0
            while true do i = i + 1 end
        `);

        await expect(lua.global.run(0, { timeout: 5 })).eventually.to.be.rejectedWith('thread timeout exceeded');
    });

    it('overwrite lib function', async () => {
        const lua = await Lua.create();

        let output = '';
        lua.ctx.print = (val) => {
            output += `${val}\n`;
        };

        await lua.doString(`
            print("hello")
            print("world")
        `);

        expect(output).to.be.equal('hello\nworld\n');
    });

    it('inject a userdata with a metatable should succeed', async () => {
        const lua = await Lua.create();
        const obj = JsType.decorate({}).index((_, k) => `Hello ${k}!`);

        lua.global.set('obj', obj);

        const res = await lua.doString('return obj.World');
        expect(res).to.be.equal('Hello World!');
    });

    it('a userdata should be collected', async () => {
        const lua = await Lua.create();
        const obj = new Object(1);
        lua.global.set('obj', obj);
        const refIndex = lua.global.luaApi.getLastRefIndex();
        const oldRef = lua.global.luaApi.getRef(refIndex);

        await lua.doString(`
            local weaktable = {}
            setmetatable(weaktable, { __mode = "v" })
            table.insert(weaktable, obj)
            obj = nil
            collectgarbage()
            assert(next(weaktable) == nil)
        `);

        expect(oldRef).to.be.equal(obj);
        const newRef = lua.global.luaApi.getRef(refIndex);
        expect(newRef).to.be.equal(undefined);
    });

    it('environment variables should be set', async () => {
        const lua = await Lua.create({
            environmentVariables: {
                TEST: 'true',
            },
        });

        const testEnvVar = await lua.doString(`return os.getenv('TEST')`);

        expect(testEnvVar).to.be.equal('true');
    });

    it('static methods should be callable on classes', async () => {
        const lua = await Lua.create();

        lua.ctx.TestClass = TestClass;

        const testHello = await lua.doString(`return TestClass.hello()`);

        expect(testHello).to.be.equal('world');
    });

    it('should be possible to access function properties', async () => {
        const lua = await Lua.create();

        const testFunction = () => undefined;
        testFunction.hello = 'world';
        lua.ctx.TestFunction = testFunction;

        const testHello = await lua.doString(`return TestFunction.hello`);

        expect(testHello).to.be.equal('world');
    });

    it('throw error includes stack trace', async () => {
        const lua = await Lua.create();
        try {
            await lua.doString(`
                local function a()
                    error("function a threw error")
                end
                local function b() a() end
                local function c() b() end
                c()
            `);
            throw new Error('should not be reached');
        } catch (err) {
            expect(err.message).to.includes('at error ([C]:?) (C:global)');
            expect(err.message).to.includes('stack traceback:');
            expect(err.message).to.includes(`at a ([string "..."]:3) (Lua:upvalue)`);
            expect(err.message).to.includes(`at b ([string "..."]:5) (Lua:upvalue)`);
            expect(err.message).to.includes(`at c ([string "..."]:6) (Lua:local)`);
            expect(err.message).to.includes(`at ? ([string "..."]:7) (main:)`);
        }
    });

    it('should get only the last result on run', async () => {
        const lua = await Lua.create();

        const a = await lua.doString(`return 1`);
        const b = await lua.doString(`return 3`);
        const c = lua.doStringSync(`return 2`);
        const d = lua.doStringSync(`return 5`);

        expect(a).to.be.equal(1);
        expect(b).to.be.equal(3);
        expect(c).to.be.equal(2);
        expect(d).to.be.equal(5);
    });

    it('should get only the return values on call function', async () => {
        const lua = await Lua.create();
        lua.global.set('hello', (name) => `Hello ${name}!`);

        const a = await lua.doString(`return 1`);
        const b = lua.doStringSync(`return 5`);
        const values = lua.global.call('hello', 'joao');

        expect(a).to.be.equal(1);
        expect(b).to.be.equal(5);
        expect(values).to.have.length(1);
        expect(values[0]).to.be.equal('Hello joao!');
    });

    it('create a large string variable should succeed', async () => {
        const lua = await Lua.create();
        const str = 'a'.repeat(1000000);

        lua.ctx.str = str;

        const res = await lua.doString('return str');

        expect(res).to.be.equal(str);
    });

    it('execute a large string should succeed', async () => {
        const lua = await Lua.create();
        const str = 'a'.repeat(1000000);

        const res = await lua.doString(`return [[${str}]]`);

        expect(res).to.be.equal(str);
    });

    it('negative integers should be pushed and retrieved as string', async () => {
        const lua = await Lua.create();

        lua.ctx.value = -1;
        const res = await lua.doString(`return tostring(value)`);

        expect(res).to.be.equal('-1');
    });

    it('negative integers should be pushed and retrieved as number', async () => {
        const lua = await Lua.create();

        lua.ctx.value = -1;
        const res = await lua.doString(`return value`);

        expect(res).to.be.equal(-1);
    });

    // is null necessary ?
    it('null injected and valid', async () => {
        const lua = await Lua.create();

        lua.ctx.null = JsType.decorate(null).tostring(() => 'null');

        lua.global.loadString(`
            local args = { ... }
            print(args[1])
            assert(args[1] == null, string.format("expected first argument to be null, got %s", tostring(args[1])))
            return null, args[1], tostring(null)
        `);
        lua.global.pushValue(null);
        const res = await lua.global.run(1);
        expect(res).to.deep.equal([null, null, 'null']);
    });

    it('Nested callback from JS to Lua', async () => {
        const lua = await Lua.create();
        lua.ctx.call = (fn) => fn();
        const res = await lua.doString(`
            return call(function ()
                return call(function ()
                    return 10
                end)
            end)
        `);
        expect(res).to.equal(10);
    });

    it('after LuaTable is destroyed, it will no longer be accessible in any way.', async () => {
        const lua = await Lua.create();

        lua.ctx.s = {
            name: 123,
        };

        const table = lua.ctx.s;
        table.$destroy();
        try {
            table.x;
        } catch (err) {
            expect(err.message).to.includes('is destroyed');
        }
    });

    // // lua5.1 does not support 64 bit integers
    // it('number greater than 32 bit int should be pushed and retrieved as string', async () => {
    //     const lua = await Lua.create();

    //     const value = 1689031554550;
    //     lua.ctx.value = value;
    //     const res = await lua.doString(`return tostring(value)`);

    //     expect(res).to.be.equal(`${String(value)}`);
    // });

    // it('number greater than 32 bit int should be pushed and retrieved as number', async () => {
    //     const engine = await getEngine();
    //     const value = 1689031554550;
    //     engine.global.set('value', value);

    //     const res = await engine.doString(`return value`);

    //     expect(res).to.be.equal(value);
    // });

    // it('number greater than 32 bit int should be usable as a format argument', async () => {
    //     const engine = await getEngine();
    //     const value = 1689031554550;
    //     engine.global.set('value', value);

    //     const res = await engine.doString(`return ("%d"):format(value)`);

    //     expect(res).to.be.equal('1689031554550');
    // });

    // TODO: Promise in lua is not supported yet
    // it('yielding in a JS callback into Lua does not break lua state', async () => {
    //     // When yielding within a callback the error 'attempt to yield across a C-call boundary'.
    //     // This test just checks that throwing that error still allows the lua global to be
    //     // re-used and doesn't cause JS to abort or some nonsense.
    //     const lua = await Lua.create();
    //     const testEmitter = new EventEmitter();
    //     lua.ctx.yield = () => new Promise((resolve) => testEmitter.once('resolve', resolve));
    //     const resPromise = lua.doString(`
    //         local res = yield():next(function ()
    //             coroutine.yield()
    //             return 15
    //         end)
    //         print("res", res:await())
    //     `);

    //     testEmitter.emit('resolve');
    //     await expect(resPromise).to.eventually.be.rejectedWith('Error: attempt to yield across a C-call boundary');

    //     expect(await lua.doString(`return 42`)).to.equal(42);
    // });

    // it('forced yield within JS callback from Lua doesnt cause vm to crash', async () => {
    //     const engine = await getEngine({ functionTimeout: 10 });
    //     engine.global.set('promise', Promise.resolve());
    //     const thread = engine.global.newThread();
    //     thread.loadString(`
    //     promise:next(function ()
    //         while true do
    //           -- nothing
    //         end
    //     end):await()
    //   `);
    //     await expect(thread.run(0, { timeout: 5 })).to.eventually.be.rejectedWith('thread timeout exceeded');

    //     expect(await engine.doString(`return 42`)).to.equal(42);
    // });

    // it('function callback timeout still allows timeout of caller thread', async () => {
    //     const engine = await getEngine();
    //     engine.global.set('promise', Promise.resolve());
    //     const thread = engine.global.newThread();
    //     thread.loadString(`
    //     promise:next(function ()
    //         -- nothing
    //     end):await()
    //     while true do end
    //   `);
    //     await expect(thread.run(0, { timeout: 5 })).to.eventually.be.rejectedWith('thread timeout exceeded');
    // });
});
