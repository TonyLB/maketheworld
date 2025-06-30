export const excludeUndefined = <T extends Exclude<any, undefined>>(value: T | undefined): value is T => (typeof value !== 'undefined')

export const zipperList = <T>(matchFunction: (a: T, b: T) => boolean) =>
    (base: T[], incoming: T[]): { base?: T; incoming?: T }[] => {
        return [
            ...base.map((baseItem) => {
                const match = incoming.find((incomingItem) => (matchFunction(baseItem, incomingItem)))
                return {
                    base: baseItem,
                    incoming: match
                }
            }),
            ...incoming
                .filter((incomingItem) => (
                    !base.find((baseItem) => (matchFunction(baseItem, incomingItem)))
                ))
                .map((incomingItem) => ({
                    base: undefined,
                    incoming: incomingItem
                }))
        ]
    }
