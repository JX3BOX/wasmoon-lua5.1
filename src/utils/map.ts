export const mapTransform = (map: Map<any, any>, refs: Map<any, any> = new Map()): Record<string, any> | any[] => {
    if (refs.has(map)) {
        return refs.get(map);
    }
    const keys = [...map.keys()];

    if (keys.some((key) => !['number', 'string'].includes(typeof key))) {
        return map;
    }

    let result: Record<string, any> = {};
    if (keys.some((key) => typeof key === 'number')) {
        result = [];
    }
    refs.set(map, result);

    for (const key of keys) {
        const value = map.get(key);
        if (value instanceof Map) {
            result[key] = mapTransform(value, refs);
            continue;
        }
        result[key] = value;
    }
    return result;
};
