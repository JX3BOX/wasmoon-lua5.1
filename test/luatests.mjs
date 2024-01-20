import { Lua } from '../dist/index.js';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function* walk(dir) {
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* walk(res);
        } else {
            yield res;
        }
    }
}

const lua = await Lua.create();
const testsPath = import.meta.resolve('../lua/test');
const filePath = fileURLToPath(typeof testsPath === 'string' ? testsPath : await Promise.resolve(testsPath));

for await (const file of walk(filePath)) {
    const relativeFile = file.replace(`${filePath}/`, '');
    lua.mountFile(relativeFile, await readFile(file));
}

// TODO
//const luamodule = lua.luaApi;
// luamodule.luaL_warn(lua.global.address, '@on', 0);
// lua.global.set('arg', ['lua', 'all.lua']);
// lua.global.set('_port', true);
// lua.global.getTable('os', (i) => {
//     lua.global.setField(i, 'setlocale', (locale) => {
//         return locale && locale !== 'C' ? false : 'C';
//     });
// });
// lua.doFileSync('all.lua');
