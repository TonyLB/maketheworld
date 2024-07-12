export const unique = <T>(...lists: T[][]): T[] => ([
    ...(new Set(lists.reduce<T[]>((previous, item) => ([ ...previous, ...item ]), [])))
])

export const toSpliced = <T extends any>(arr: T[], start: number, replace: number, ...addArgs: T[]): T[] => {
    const returnVal = [
        ...arr.slice(0, start),
        ...addArgs,
        ...arr.slice(Math.max(start + replace, 0))
    ]
    return returnVal
}

export const excludeUndefined = <T extends Exclude<any, undefined>>(value: T | undefined): value is T => (typeof value !== 'undefined')
