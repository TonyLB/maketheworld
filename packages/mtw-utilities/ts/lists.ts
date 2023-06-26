export const unique = <T>(...lists: T[][]): T[] => ([
    ...(new Set(lists.reduce<T[]>((previous, item) => ([ ...previous, ...item ]), [])))
])
