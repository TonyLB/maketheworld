export const unique = <T>(...lists: T[][]): T[] => ([
    ...(new Set(lists.reduce<T[]>((previous, item) => ([ ...previous, ...item ]), [])))
])

export const toSpliced = <T extends any>(arr: T[], start: number, replace: number, ...addArgs: T[]): T[] => ([
    ...(start > 0 ? arr.slice(0, start - 1) : []),
    ...addArgs,
    ...arr.slice(start + replace)
])
