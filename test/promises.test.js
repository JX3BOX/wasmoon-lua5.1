const { expect, test } = require('@jest/globals')
const { getEngine, tick } = require('./utils')

jest.useFakeTimers()

test('use promise next should succeed', async () => {
    const engine = await getEngine()
    const check = jest.fn()
    engine.global.set('check', check)
    const promise = new Promise((resolve) => setTimeout(() => resolve(60), 10))
    engine.global.set('promise', promise)

    engine.doString(`
        promise:next(check)
    `)

    expect(check).not.toBeCalled()
    jest.advanceTimersByTime(20)
    await promise
    expect(check).toBeCalledWith(60)
})

test('chain promises with next should succeed', async () => {
    const engine = await getEngine()
    const check = jest.fn()
    engine.global.set('check', check)
    const promise = new Promise((resolve) => resolve(60))
    engine.global.set('promise', promise)

    engine.doString(`
        promise:next(function(value)
            return value * 2
        end):next(check):next(check)
    `)

    await promise
    await tick()

    expect(check).toBeCalledWith(120)
    expect(check).toBeCalledTimes(2)
})

test('call an async function should succeed', async () => {
    const engine = await getEngine()
    engine.global.set('asyncFunction', async () => Promise.resolve(60))
    const check = jest.fn()
    engine.global.set('check', check)

    engine.doString(`
        asyncFunction():next(check)
    `)

    await tick()
    expect(check).toBeCalledWith(60)
})

test('return an async function should succeed', async () => {
    const engine = await getEngine()
    engine.global.set('asyncFunction', async () => Promise.resolve(60))

    const asyncFunction = engine.doString(`
        return asyncFunction
    `)
    const value = await asyncFunction()

    expect(value).toBe(60)
})

test('return a chained promise should succeed', async () => {
    const engine = await getEngine()
    engine.global.set('asyncFunction', async () => Promise.resolve(60))

    const asyncFunction = engine.doString(`
        return asyncFunction():next(function(x) return x * 2 end)
    `)
    const value = await asyncFunction

    expect(value).toBe(120)
})

test('await an promise inside coroutine should succeed', async () => {
    const engine = await getEngine()
    const check = jest.fn()
    engine.global.set('check', check)
    const promise = new Promise((resolve) => setTimeout(() => resolve(60), 10))
    engine.global.set('promise', promise)

    engine.doString(`
        coroutine.resume(coroutine.create(function()
            local value = promise:await()
            check(value)
        end))
    `)

    expect(check).not.toBeCalled()
    jest.advanceTimersByTime(20)
    await promise
    expect(check).toBeCalledWith(60)
})

test('awaited coroutines should ignore resume until it resolves the promise', async () => {
    const engine = await getEngine()
    const check = jest.fn()
    engine.global.set('check', check)
    const promise = new Promise((resolve) => setTimeout(() => resolve(60), 10))
    engine.global.set('promise', promise)

    engine.doString(`
        local co = coroutine.create(function()
            local value = promise:await()
            check(value)
        end)
        coroutine.resume(co)
        coroutine.resume(co)
        coroutine.resume(co)
        coroutine.resume(co)
        coroutine.resume(co)
    `)

    expect(check).not.toBeCalled()
    jest.advanceTimersByTime(20)
    await promise
    await tick()
    expect(check).toBeCalledWith(60)
})

test('await an promise outside coroutine should throw', async () => {
    const engine = await getEngine()
    const promise = new Promise((resolve) => setTimeout(() => resolve(60), 10))
    engine.global.set('promise', promise)

    expect(() => {
        engine.doString(`
            promise:await()
        `)
    }).toThrow()
})

test('await a thread run with async calls should succeed', async () => {
    const engine = await getEngine()
    engine.global.set('sleep', (input) => new Promise((resolve) => setTimeout(resolve, input)))
    const asyncThread = engine.global.newThread()

    asyncThread.loadString(`
        sleep(1):await()
        return 50
    `)

    const asyncFunctionPromise = asyncThread.run()
    jest.runAllTimers()
    expect(await asyncFunctionPromise).toEqual([50])
})

test('run thread with async calls and yields should succeed', async () => {
    const engine = await getEngine()
    engine.global.set('sleep', (input) => new Promise((resolve) => setTimeout(resolve, input)))
    const asyncThread = engine.global.newThread()

    asyncThread.loadString(`
        coroutine.yield()
        sleep(1):await()
        coroutine.yield()
        return 50
    `)

    const asyncFunctionPromise = asyncThread.run()
    jest.runAllTimers()
    expect(await asyncFunctionPromise).toEqual([50])
})

test('reject a promise should succeed', async () => {
    const engine = await getEngine()
    engine.global.set('throw', () => new Promise((_, reject) => reject(new Error('expected test error'))))
    const asyncThread = engine.global.newThread()

    asyncThread.loadString(`
        throw():await()
    `)

    await expect(() => asyncThread.run()).rejects.toThrow()
})

test('pcall a promise await should succeed', async () => {
    const engine = await getEngine()
    engine.global.set('throw', () => new Promise((_, reject) => reject(new Error('expected test error'))))
    const asyncThread = engine.global.newThread()

    asyncThread.loadString(`
        local succeed, err = pcall(throw().await)
        assert(err == "expected test error")
        return succeed
    `)

    expect(await asyncThread.run()).toEqual([false])
})

test('catch a promise rejection should succeed', async () => {
    const engine = await getEngine()
    const fulfilled = jest.fn()
    const rejected = jest.fn()
    engine.global.set('handlers', { fulfilled, rejected })
    engine.global.set('throw', new Promise((_, reject) => reject(new Error('expected test error'))))

    engine.doString(`
        throw:next(handlers.fulfilled, handlers.rejected)
    `)

    await tick()
    expect(fulfilled).not.toBeCalled()
    expect(rejected).toBeCalled()
})

test('run with async callback', async () => {
    const engine = await getEngine()
    const thread = engine.global.newThread()

    thread.set('asyncCallback', async (input) => {
        return Promise.resolve(input * 2)
    })

    thread.loadString(`
        local input = ...
        assert(type(input) == "number")
        assert(type(asyncCallback) == "function")
        local result1 = asyncCallback(input):await()
        local result2 = asyncCallback(result1):await()
        return result2
    `)

    thread.pushValue(3)
    const [finalValue] = await thread.run(1)

    expect(finalValue).toEqual(3 * 2 * 2)
})
