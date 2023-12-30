export const zipList = <T extends any, O extends any>(list: T[], callback: (value: { first?: T; second?: T }) => O): O[] => {
    if (list.length === 0) {
        return []
    }
    const { returnValue, buffer } = list.reduce<{ returnValue: O[]; buffer?: T}>(({ returnValue, buffer }, item) => {
        const returnItem = callback({ first: buffer, second: item })
        return {
            returnValue: [
                ...returnValue,
                returnItem
            ],
            buffer: item
        }
    }, { returnValue: [] })
    const finalReturn = callback({ first: buffer })
    return [
        ...returnValue,
        finalReturn
    ]
}

export const unique = <T>(...lists: T[][]): T[] => ([
    ...(new Set(lists.reduce<T[]>((previous, item) => ([ ...previous, ...item ]), [])))
])
