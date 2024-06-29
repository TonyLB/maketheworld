export type NarrowOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

export const assertTypeguard = <T extends any, G extends T>(value: T, typeguard: (value) => value is G): G | undefined => {
    if (value && typeguard(value)) {
        return value
    }
    return undefined
}
