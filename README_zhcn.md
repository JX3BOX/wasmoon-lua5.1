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
