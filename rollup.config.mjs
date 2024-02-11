import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import pkg from './package.json' assert { type: 'json' };

const production = !process.env.ROLLUP_WATCH;

export default [
    {
        input: './src/index.ts',
        output: [
            {
                file: 'dist/index.js',
                format: 'umd',
                name: 'wasmoon-lua5.1',
                sourcemap: !production,
                globals: {
                    lodash: 'lodash',
                },
            },
        ],
        external: ['lodash', 'module'],
        plugins: [
            typescript({
                tsconfig: './tsconfig.json',
                sourceMap: !production,
                declaration: false,
            }),
            copy({
                targets: [{ src: 'build/liblua5.1.wasm', dest: 'dist' }],
            }),
            json(),
        ],
    },
    {
        input: './src/index.ts',
        output: { file: 'dist/index.d.ts', format: 'es' },
        plugins: [dts()],
    },
];
