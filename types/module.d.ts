declare module '*.wasm' {
    const value: string;
    export default value;
}

declare module '*.js';

declare type EnvironmentVariables = Record<string, string | undefined>;
