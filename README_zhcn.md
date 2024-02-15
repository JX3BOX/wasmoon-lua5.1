### 关于数据交互

关于js的object与lua的table交互的问题，1.18.0以前的方案是做一次性的转换，如

```js
const obj = { name: 233 };
lua.ctx.obj = obj; //table
const o = lua.ctx.obj; // object,但是和obj不是一个对象,是一个值相同但是引用不同的新对象。
```

这样会存在一些问题，首先lua的table相对更奔放一些，它允许任意类型的键，以及他的数组索引是从1开始的。  
以及无法实现数据绑定，即把js的object加入lua之后，无法再从js层面操作lua的table。以及在js修改提取出的table后无法通过修改js的对象影响table的值。  
所以从1.18.0开始，当尝试把js的plainObject注入lua环境中时，像之前一样会创建一个table。但是当从lua中导出一个table时，不会再尝试将其组成一个对象，而是生成一个代理的LuaTable类，可以对其进行任意的index，newindex操作以修改lua内的table。  
这个LuaTable类提供了一系列方法:

-   `$get` 获取值，因为js如果对对象index的时候，key会被自动转换为string。无法正常访问number类型的键。
-   `$set` 设置值，理由同上
-   `$detach` 类似1.18.0以前的操作，返回一个与lua环境脱钩的Map（可以传入参数返回object或者array）
-   `$istable` 用于判断是不是一个table
-   `$getRef` 获取table在lua环境注册表中的索引

可以像这样使用：

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

### 关于字符编码的问题

Lua内部的字符串并不像js一样有特别的储存方式，某种意义上他跟c是一样的，存储的是纯粹的字节数组，那么就会产生一种情况。当在lua和js之间进行字符串的数据交换的时候，lua会尝试给出一个char类型的指针供宿主环境解析，但是wasm会默认使用utf8编码进行解析，那么问题就来了。如果Lua读取的文件是gbk编码就会导致不可逆的乱码问题。

怎么解决这个问题呢？常见的方法是通过在lua里先base64或者直接获取字节数组的办法先将其转义成ansi范围内包含的字符，防止乱码。然后在js端对应位置需要读取的时候再进行翻译。这个翻译可以使用`iconv.decode(Buffer.from(data, 'base64'))`进行。

但是这种方式也可能存在问题，因为目前该项目，如果尝试往lua环境注入一个非plainObject的类型，在lua内的userdata实际上是一个代理，任何操作最后都会回到js端托管。比如

```js
const lua = await Lua.create();

class TestClass {}
const test = new TestClass();

lua.ctx.test = test;

await lua.doString(`
    test.func = function(str) print(str) end
`);
```

此时`test.func`虽然是定义在lua内，但是由于test是一个被代理的userdata。func会经过一层js的包装，实际上它就变成了一个lua function的wrapper，实际上是一个js函数。

那么会产生什么问题呢？向它传入的字符串无法经过转义，因为func方法里面再怎么写，参数都会传递到js在进行执行，而字符串只要经过了js编码不是utf8就会乱码。要解决这个问题，要么就是确保lua内的test是一个简单的table。起码不是一个来自js的代理防止字符串参数不经处理就传递到了js端。

但是这样一来如果test的其它function内有this就会导致this的指向混乱，无法修改table。因为其他的function是在js环境的，但是在lua里面运行这些function我们肯定是希望能够修改table的值的。

> 想了想是不是可以在pushTable的时候，如果键或者是值如果是function，为其指定一个经过proxy的this。如果在function内操作了this将其操作转换为对目标table的操作？大概思路是可以的。以后再写（x

另一个解决方法就是通过`JsType.decorate`重写注入对象的index和newindex元表，在lua内为对象添加方法的时候不单为js端的对象添加方法，也为lua端的对象添加方法，当进行index操作的时候，先检查lua端的对象是否有原生的方法或者值，有的话直接返回原生方法，不获取js的function wrapper。就可以在原生方法内对gbk编码的字符串进行转义。

具体实现可以参考 [https://github.com/JX3BOX/jx3-skill-parser/blob/master/src/wasmoon-helper.ts](https://github.com/JX3BOX/jx3-skill-parser/blob/master/src/wasmoon-helper.ts)
