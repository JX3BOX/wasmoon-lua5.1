// 仅描述构建时生成的胶水模块，不再用 *.js 声明屏蔽所有 JS 导入错误。
declare module '*liblua5.1.js' {
    const initialize: (options: {
        locateFile(path: string, directory: string): string;
        preRun(module: import('./types').LuaEmscriptenModule): void;
    }) => Promise<import('./types').LuaEmscriptenModule>;
    export default initialize;
}
