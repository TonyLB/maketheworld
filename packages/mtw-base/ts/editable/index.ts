export type StandardEditableData<T extends any> = T | {
    tag: 'Remove';
    match: T;
} | {
    tag: 'Replace';
    match: T;
    payload: T;
}

export const editWrappedTypeguard = <T extends any>(typeguard: (x: any) => x is T) => (data: any): data is StandardEditableData<T> => {
    if (typeguard(data)) {
        return true;
    }
    if (typeof data === 'object' && data !== null) {
        if (data.tag === 'Remove' && typeguard(data.match)) {
            return true
        }
        if (data.tag === 'Replace' && typeguard(data.match) && typeguard(data.payload)) {
            return true
        }
    }
    return false
}

/**
 * Extract all values from StandardEditableData<T>, unwrapping Remove/Replace wrappers.
 * Similar to recurseIntoEditable but works on the JSON serialization format instead of schema nodes.
 * 
 * Returns an array of all contained values:
 * - Plain value: returns [value]
 * - Remove: returns [match]
 * - Replace: returns [match, payload]
 */
export const extractFromEditableData = <T>(data: StandardEditableData<T>): T[] => {
    // Plain value - return as array
    if (typeof data !== 'object' || data === null || !('tag' in data)) {
        return [data as T]
    }
    // Remove: extract match
    if (data.tag === 'Remove' && 'match' in data) {
        return [data.match]
    }
    // Replace: extract match and payload
    if (data.tag === 'Replace' && 'match' in data && 'payload' in data) {
        return [data.match, data.payload]
    }
    return []
}
