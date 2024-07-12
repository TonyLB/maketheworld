export const unique = <T>(...lists: T[][]): T[] => ([
    ...(new Set(lists.reduce<T[]>((previous, item) => ([ ...previous, ...item ]), [])))
])

export const excludeUndefined = <T extends Exclude<any, undefined>>(value: T | undefined): value is T => (typeof value !== 'undefined')
