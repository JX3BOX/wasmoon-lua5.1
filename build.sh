#!/bin/bash -e
cd $(dirname $0)
mkdir -p build

LUA_SRC=$(ls ./lua/src/*.c | grep -v "luac.c" | grep -v "lua.c" | tr "\n" " ")

extension=""
if [ "$1" == "dev" ];
then
    extension="-O0 -g3 -s ASSERTIONS=1 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=2"
else
    # TODO: This appears to be a bug in emscripten. Disable assertions when that bug is resolved or a workaround found.
    # ASSERTIONS=1 required with optimisations and strict mode. https://github.com/emscripten-core/emscripten/issues/20721
    extension="-O3 --closure 1 -s ASSERTIONS=1"
fi

emcc \
    -Wno-empty-body \
    -s WASM=1 $extension -o ./build/liblua5.1.js \
    -s EXPORTED_RUNTIME_METHODS="[
        'ccall', \
        'addFunction', \
        'removeFunction', \
        'FS', \
        'ENV', \
        'getValue', \
        'setValue', \
        'lengthBytesUTF8', \
        'stringToUTF8', \
        'stringToNewUTF8'
    ]" \
    -s INCOMING_MODULE_JS_API="[
        'locateFile', \
        'preRun'
    ]" \
    -s STRICT_JS=0 \
    -s MODULARIZE=1 \
    -s ALLOW_TABLE_GROWTH=1 \
    -s EXPORT_NAME="initWasmModule" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s STRICT=1 \
    -s EXPORT_ES6=1 \
    -s NODEJS_CATCH_EXIT=0 \
    -s NODEJS_CATCH_REJECTION=0 \
    -s MALLOC=emmalloc \
    -s STACK_SIZE=4MB \
    -s EXPORTED_FUNCTIONS="[
        '_malloc', \
        '_free', \
        '_realloc', \

        '_luaL_error',\
        '_luaL_typerror',\
        '_luaL_argerror',\

        '_luaL_addlstring',\
        '_luaL_addstring',\
        '_luaL_addvalue',\

        '_luaL_checkany',\
        '_luaL_checkinteger',\
        '_luaL_checklstring',\
        '_luaL_checknumber',\
        '_luaL_checkoption',\
        '_luaL_checkstack',\
        '_luaL_checktype',\
        '_luaL_checkudata',\

        '_luaL_loadbuffer',\
        '_luaL_loadfile',\
        '_luaL_loadstring',\

        '_luaL_buffinit',\
        '_luaL_callmeta',\
        '_luaL_getmetafield',\
        '_luaL_gsub',\

        '_luaL_newmetatable',\
        '_luaL_newstate',\
        '_luaL_openlibs',\
        '_luaL_optinteger',\
        '_luaL_optlstring',\
        '_luaL_optnumber',\
        '_luaL_prepbuffer',\
        '_luaL_pushresult',\
        '_luaL_register',\
        '_luaL_ref',\
        '_luaL_unref',\
        '_luaL_where',\
       
        '_lua_atpanic',\
        '_lua_call',\
        '_lua_checkstack',\
        '_lua_close',\
        '_lua_concat',\
        '_lua_cpcall',\
        '_lua_createtable',\
        '_lua_dump',\
        '_lua_equal',\
        '_lua_error',\
        '_lua_gc',\
        '_lua_getallocf',\
        '_lua_getfenv',\
        '_lua_getfield',\
        '_lua_gethook',\
        '_lua_gethookcount',\
        '_lua_gethookmask',\
        '_lua_getinfo',\
        '_lua_getlocal',\
        '_lua_getmetatable',\
        '_lua_getstack',\
        '_lua_gettable',\
        '_lua_gettop',\
        '_lua_getupvalue',\
        '_lua_insert',\
        '_lua_iscfunction',\
        '_lua_isnumber',\
        '_lua_isstring',\
        '_lua_isuserdata',\
        '_lua_lessthan',\
        '_lua_load',\
        '_lua_newstate',\
        '_lua_newthread',\
        '_lua_newuserdata',\
        '_lua_next',\
        '_lua_objlen',\
        '_lua_pcall',\
        '_lua_pushboolean',\
        '_lua_pushcclosure',\
        '_lua_pushfstring',\
        '_lua_pushinteger',\
        '_lua_pushlightuserdata',\
        '_lua_pushlstring',\
        '_lua_pushnil',\
        '_lua_pushnumber',\
        '_lua_pushstring',\
        '_lua_pushthread',\
        '_lua_pushvalue',\
        '_lua_pushvfstring',\
        '_lua_rawequal',\
        '_lua_rawget',\
        '_lua_rawgeti',\
        '_lua_rawset',\
        '_lua_rawseti',\
        '_lua_remove',\
        '_lua_replace',\
        '_lua_resume',\
        '_lua_setallocf',\
        '_lua_setfenv',\
        '_lua_setfield',\
        '_lua_sethook',\
        '_lua_setlocal',\
        '_lua_setmetatable',\
        '_lua_settable',\
        '_lua_settop',\
        '_lua_setupvalue',\
        '_lua_status',\
        '_lua_toboolean',\
        '_lua_tocfunction',\
        '_lua_tointeger',\
        '_lua_tolstring',\
        '_lua_tonumber',\
        '_lua_topointer',\
        '_lua_tothread',\
        '_lua_touserdata',\
        '_lua_type',\
        '_lua_typename',\
        '_lua_xmove',\
        '_lua_yield',\

        '_luaopen_base', \
        '_luaopen_table', \
        '_luaopen_io', \
        '_luaopen_os', \
        '_luaopen_string', \
        '_luaopen_math', \
        '_luaopen_debug', \
        '_luaopen_package', \
        '_luaL_openlibs' \
    ]" \
    ${LUA_SRC}
