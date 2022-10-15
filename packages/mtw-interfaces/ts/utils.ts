export const checkAll = (...items: boolean[]): boolean => (
    items.reduce<boolean>((previous, item) => (previous && item), true)
)

export const checkTypes = (item: any, requiredList: Record<string, 'string' | 'number' | 'boolean'>, optionalList?: Record<string, 'string' | 'number' | 'boolean'>): boolean => {
    if (typeof item !== 'object') {
        return false
    }
    if (!Object.entries(requiredList).reduce<boolean>((previous, [key, typeString]) => (
        previous && (key in item && typeof(item[key]) === typeString)
    ), true)) {
        return false
    }
    return Object.entries(optionalList || {}).reduce<boolean>((previous, [key, typeString]) => (
        previous && (!(key in item) || typeof(item[key]) === typeString)
    ), true)
}
