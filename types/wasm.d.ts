interface LuaEmscriptenModule extends EmscriptenModule {
    ccall: typeof ccall;
    addFunction: typeof addFunction;
    removeFunction: typeof removeFunction;
    setValue: typeof setValue;
    getValue: typeof getValue;
    FS: typeof FS;
    stringToNewUTF8: typeof allocateUTF8;
    lengthBytesUTF8: typeof lengthBytesUTF8;
    stringToUTF8: typeof stringToUTF8;
    UTF8ToString: typeof UTF8ToString;
    ENV: EnvironmentVariables;
    _realloc: (pointer: number, size: number) => number;
    _malloc: (size: number) => number;
}

interface ReferenceMetadata {
    index: number;
    refCount: number;
}
