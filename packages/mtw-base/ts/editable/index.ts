export type StandardEditableData<T extends any> = T | {
    tag: 'Remove';
    match: T;
} | {
    tag: 'Replace';
    match: T;
    payload: T;
}
