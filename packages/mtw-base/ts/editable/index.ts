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
