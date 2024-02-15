import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import fs from 'fs';

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
            nodePolyfills(),
        ],
    },
    {
        input: './src/index.ts',
        output: { file: 'dist/index.d.ts', format: 'es' },
        plugins: [
            dts(),
            {
                name: 'reference',
                banner: fs
                    .readdirSync(`types`)
                    .map((s) => `/// <reference path="../types/${s}" />`)
                    .join('\n'),
            },
        ],
    },
];
