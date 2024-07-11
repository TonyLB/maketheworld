export const excludeUndefined = <T extends Exclude<any, undefined>>(value: T | undefined): value is T => (typeof value !== 'undefined')
