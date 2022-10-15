export const checkAll = (...items: boolean[]): boolean => (
    items.reduce<boolean>((previous, item) => (previous && item), true)
)

export const checkTypes = (item: any, requiredList: Record<string, 'string' | 'number' | 'boolean'>, optionalList?: Record<string, 'string' | 'number' | 'boolean'>): boolean => {
    if (typeof item !== 'object') {
        console.log(`Not of type item: ${JSON.stringify(item, null, 4)}`)
        return false
    }
    if (!Object.entries(requiredList).reduce<boolean>((previous, [key, typeString]) => (
        previous && key in item && typeof(item[key]) === typeString
    ), true)) {
        console.log(`Failed required types: ${JSON.stringify(item, null, 4)}`)
        return false
    }
    if (!Object.entries(optionalList || {}).reduce<boolean>((previous, [key, typeString]) => (
        previous && ((!(key in item)) || typeof(item[key]) === typeString)
    ), true)) {
        console.log(`Failed optional types: ${JSON.stringify(item, null, 4)}`)
        return false
    }
    return true
}
