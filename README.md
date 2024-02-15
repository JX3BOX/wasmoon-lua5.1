# Wasmoon-lua5.1

[![Build Status](https://github.com/X3ZvaWQ/wasmoon-lua5.1/actions/workflows/publish.yml/badge.svg)](https://github.com/ceifa/wasmoon/actions/workflows/publish.yml)
[![npm](https://img.shields.io/npm/v/wasmoon-lua5.1.svg)](https://npmjs.com/package/wasmoon-lua5.1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## From

[ceifa/wasmoon](https://github.com/ceifa/wasmoon)

This repository has made some modifications based on this repository, adapting it to the lua5.1 version. At the same time, some functions of this repository have been optimized/adapted/adjusted.

This package aims to provide a way to:

-   Embed Lua to any Node.js, Deno or Web Application.
-   Run lua code in any operational system
-   Interop Lua and JS without memory leaks (including the DOM)

## API Usage

To initialize, create a new Lua state, register the standard library, set a global variable, execute a code and get a global variable:

```js
const { Lua } = require('wasmoon-lua5.1');

// create lua global (also a wasm instance)
const lua = await Lua.create();

try {
    // get context, a proxy. It will be used to interact with lua conveniently
    const ctx = lua.ctx;
    ctx.add = (a, b) => a + b;
    console.log(ctx.add(114514, 1919810));
    lua.doString(`
        print(add(114514, 1919810))
    `);
} finally {
    // Close the lua environment, so it can be freed
    lua.global.close();
}
```

### About data interaction

Regarding the issue of interacting between JavaScript objects and Lua tables, the previous solution before version 1.18.0 was to perform a one-time conversion, such as:

```js
const obj = { name: 233 };
lua.ctx.obj = obj; // table
const o = lua.ctx.obj; // object, but not the same object as obj, it is a new object with the same value but different reference.
```

This approach has some problems. First of all, Lua tables are more flexible in that they allow keys of any type and their array indices start from 1.

Furthermore, it is not possible to achieve data binding. After adding a JavaScript object to Lua, it is not possible to manipulate the Lua table from the JavaScript layer. Also, modifying an extracted table in JavaScript does not affect the values of the table by modifying the JavaScript object.

Therefore, starting from version 1.18.0, when attempting to inject a plainObject from JavaScript into the Lua environment, a table will be created just like before. However, when exporting a table from Lua, instead of trying to convert it into an object as before, a proxy class called "LuaTable" will be generated which allows arbitrary index and newindex operations on its underlying Lua table.

The "LuaTable" class provides a series of methods:

-   `$get` for getting values because when indexing an object in JavaScript,
    the key will be automatically converted to string and cannot access keys of number type properly.
-   `$set` for setting values for similar reasons as above.
-   `$detach` similar operation as before version 1.18.0,
    returns a Map detached from the Lua environment (can pass parameters to return an object or array).
-   `$istable` used for determining if it is a table.
-   `$getRef` gets the index of this table in lua's registry.

It can be used like this:

```js
import { Lua } from '../dist/index.js';
// This file was created as a sandbox to test and debug on vscode

const lua = await Lua.create();

const obj = {};
lua.ctx.obj = obj;

const o = lua.ctx.obj;
o.name = 23333;
console.log(o.name); // 23333

lua.doStringSync('print(obj.name)'); // 23333
```

### About the issue of character encoding

The internal strings in Lua do not have a special storage method like JavaScript. In a sense, they are similar to C and store pure byte arrays. This can lead to a situation where when exchanging string data between Lua and JavaScript, Lua will try to provide a char type pointer for the host environment to parse. However, wasm defaults to using UTF-8 encoding for parsing, which creates a problem. If the file read by Lua is encoded in GBK, it will result in irreversible garbled characters.

How to solve this problem? The common approach is to first escape it into ANSI range characters within Lua through methods such as base64 or directly obtaining byte arrays, in order to prevent garbled characters. Then, when needed on the JavaScript side at the corresponding position for reading, perform translation. This translation can be done using `iconv.decode(Buffer.from(data,'base64'))`.

However, this approach may also have issues because currently in this project if an object of non-plainObject type is attempted to be injected into the Lua environment, userdata inside Lua is actually a proxy that ultimately returns control back to JavaScript for any operation performed. For example:

```js
const lua = await Lua.create();
class TestClass {}
const test = new TestClass();
lua.ctx.test = test;
await lua.doString(`
test.func = function(str) print(str) end
`);
```

At this time although `test.func` is defined inside Lua, since `test` is a proxied userdata, func goes through an additional layer of wrapping by JavaScript and becomes essentially a wrapper of a lua function - actually being just a JavaScript function.

So what problems does this cause? The passed-in string cannot be escaped because no matter how func method is written inside it gets passed back for execution by JavaScript; and if the string has undergone any encoding other than UTF-8 in JS then it will become garbled. To solve this problem, either ensure that `test` inside Lua is a simple table, or at least not a proxy from JavaScript to prevent passing string parameters without processing back to the JS side.
However, if it's done this way and other functions within test have `this`, it will lead to confusion in terms of what `this` refers to and make modifying the table impossible. This is because other functions are in the JS environment but we certainly want them to be able to modify the value of the table when running these functions inside Lua.

> I thought about whether it would be possible during pushTable, if the key or value is a function, assign it a `this` that has gone through proxy. If any operations on this are performed within the function then convert those operations into operations on the target table? The general idea seems feasible. Will write more later (x

Another solution is to override the index and newindex metamethods for injected objects using `JsType.decorate`. When adding methods for objects in Lua, not only add methods for JavaScript-side objects but also add methods for Lua-side objects. When performing an index operation, first check if there are native methods or values in the Lua-side object; if so, directly return those native methods without obtaining JavaScript's function wrapper. This allows escaping GBK-encoded strings within native methods.

For specific implementation details, please refer to [https://github.com/JX3BOX/jx3-skill-parser/blob/master/src/wasmoon-helper.ts](https://github.com/JX3BOX/jx3-skill-parser/blob/master/src/wasmoon-helper.ts)

## CLI Usage

Although Wasmoon has been designed to be embedded, you can run it on command line as well, but, if you want something more robust on this, we recommend to take a look at [demoon](https://github.com/ceifa/demoon).

```sh
$: wasmoon [options] [file] [args]
```

Available options are:

-   `-l`: Include a file or directory
-   `-i`: Enter interactive mode after running the files

### Example

```sh
$: wasmoon -i sum.lua 10 30
```

And if you are in Unix, you can also use it as a script interpreter with [Shebang](<https://en.wikipedia.org/wiki/Shebang_(Unix)>):

```lua
#!/usr/bin/env wasmoon
return arg[1] + arg[2]
```

```sh
$: ./sum.lua 10 30
```

## When to use wasmoon and fengari

Wasmoon compiles the [official Lua code](https://github.com/lua/lua) to webassembly and creates an abstraction layer to interop between Lua and JS, instead of [fengari](https://github.com/fengari-lua/fengari), that is an entire Lua VM rewritten in JS.

### Performance

Because of wasm, wasmoon will run Lua code much faster than fengari, but if you are going to interop a lot between JS and Lua, this may be not be true anymore, you probably should test on you specific use case to take the prove.

This is the results running a [heap sort code](https://github.com/ceifa/wasmoon/blob/main/bench/heapsort.lua) in a list of 2k numbers 10x(less is better):

| wasmoon  | fengari   |
| -------- | --------- |
| 15.267ms | 389.923ms |

### Size

Fengari is smaller than wasmoon, which can improve the user experience if in web environments:

|             | wasmoon | fengari |
| ----------- | ------- | ------- |
| **plain**   | 393kB   | 214kB   |
| **gzipped** | 130kB   | 69kB    |

## Fixing common errors on web environment

Bundle/require errors can happen because wasmoon tries to safely import some node modules even in a browser environment, the bundler is not prepared to that since it tries to statically resolve everything on build time.
Polyfilling these modules is not the right solution because they are not actually being used, you just have to ignore them:

### Webpack

Add the `resolve.fallback` snippet to your config:

```js
module.exports = {
    entry: './src/index.js', // Here is your entry file
    resolve: {
        fallback: {
            path: false,
            fs: false,
            child_process: false,
            crypto: false,
            url: false,
            module: false,
        },
    },
};
```

### Rollup

With the package [rollup-plugin-ignore](https://www.npmjs.com/package/rollup-plugin-ignore), add this snippet to your config:

```js
export default {
    input: 'src/index.js', // Here is your entry file,
    plugins: [ignore(['path', 'fs', 'child_process', 'crypto', 'url', 'module'])],
};
```

### Angular

Add the section browser on `package.json`:

```json
{
    "main": "src/index.js",
    "browser": {
        "child_process": false,
        "fs": false,
        "path": false,
        "crypto": false,
        "url": false,
        "module": false
    }
}
```

## How to build

Firstly download the lua submodule and install the other Node.JS dependencies:

```sh
git submodule update --init # download lua submodule
npm i # install dependencies
```

### Windows / Linux / MacOS (Docker way)

You need to install [docker](https://www.docker.com/) and ensure it is on your `PATH`.

After cloned the repo, to build you just have to run these:

```sh
npm run build:wasm:docker:dev # build lua
npm run build # build the js code/bridge
npm test # ensure everything it's working fine
```

### Ubuntu / Debian / MacOS

You need to install [emscripten](https://emscripten.org/) and ensure it is on your `PATH`.

After cloned the repo, to build you just have to run these:

```sh
npm run build:wasm:dev # build lua
npm run build # build the js code/bridge
npm test # ensure everything it's working fine
```

## Edge Cases

### Null

`null` is injected as userdata type if `injectObjects` is set to `true`. This works as expected except that it will evaluate to `true` in Lua.

### Promises

Promises can be await'd from Lua with some caveats detailed in the below section. To await a Promise call `:await()` on it which will yield the Lua execution until the promise completes.

```js
const { LuaFactory } = require('wasmoon');
const factory = new LuaFactory();
const lua = await factory.createEngine();

try {
    lua.global.set('sleep', (length) => new Promise((resolve) => setTimeout(resolve, length)));
    await lua.doString(`
        sleep(1000):await()
    `);
} finally {
    lua.global.close();
}
```

### Async/Await

It's not possible to await in a callback from JS into Lua. This is a limitation of Lua but there are some workarounds. It can also be encountered when yielding at the top-level of a file. An example where you might encounter this is a snippet like this:

```js
local res = sleep(1):next(function ()
    sleep(10):await()
    return 15
end)
print("res", res:await())
```

Which will throw an error like this:

```js
Error: Lua Error(ErrorRun/2): cannot resume dead coroutine
    at Thread.assertOk (/home/tstableford/projects/wasmoon/dist/index.js:409:23)
    at Thread.<anonymous> (/home/tstableford/projects/wasmoon/dist/index.js:142:22)
    at Generator.throw (<anonymous>)
    at rejected (/home/tstableford/projects/wasmoon/dist/index.js:26:69)
```

Or like this:

```js
attempt to yield across a C-call boundary
```

You can workaround this by doing something like below:

```lua
function async(callback)
    return function(...)
        local co = coroutine.create(callback)
        local safe, result = coroutine.resume(co, ...)

        return Promise.create(function(resolve, reject)
            local function step()
                if coroutine.status(co) == "dead" then
                    local send = safe and resolve or reject
                    return send(result)
                end

                safe, result = coroutine.resume(co)

                if safe and result == Promise.resolve(result) then
                    result:finally(step)
                else
                    step()
                end
            end

            result:finally(step)
        end)
    end
end
```
