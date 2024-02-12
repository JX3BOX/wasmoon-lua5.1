export enum DictType {
    Array,
    Object,
    Map,
}

export declare interface MapTransformOptions {
    refs?: Map<any, any>;
    dictType?: DictType;
}

const detectDuplicateKeys = (keys: any[]): boolean => {
    const set = new Set();
    for (const _key of keys) {
        const key = String(_key);
        if (set.has(key)) {
            return true;
        }
        set.add(key);
    }
    return false;
};

const detectDictType = (keys: any[]): DictType => {
    if (keys.some((key) => !['number', 'string'].includes(typeof key)) || detectDuplicateKeys(keys)) {
        return DictType.Map;
    } else if (keys.some((key) => typeof key === 'number')) {
        return DictType.Array;
    } else {
        return DictType.Object;
    }
};

export const mapTransform = (map: Map<any, any>, options: MapTransformOptions = {}): Record<string, any> | any[] | Map<any, any> => {
    if (!options.refs) {
        options.refs = new Map();
    }
    if (options.refs.has(map)) {
        return options.refs.get(map);
    }
    const keys = [...map.keys()];

    // detect output type
    const dictType = options.dictType ? options.dictType : detectDictType(keys);
    if (dictType === DictType.Map) {
        return map;
    }
    const result: Record<any, any> = dictType === DictType.Array ? [] : {};
    options.refs.set(map, result);

    for (const key of keys) {
        const value = map.get(key);
        if (value instanceof Map) {
            result[key] = mapTransform(value, options);
            continue;
        }
        result[key] = value;
    }
    return result;
};
