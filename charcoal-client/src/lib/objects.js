//
// Some Typescript helper functions to deal with Object.entries typing in cases
// when we no that no excess values will be included
//
// Borrowed from: https://stackoverflow.com/questions/60141960/typescript-key-value-relation-preserving-object-entries-type
//
// type PickByValue<T, V> = Pick<T, { [K in keyof T]: T[K] extends V ? K : never }[keyof T]>
// export type Entries<T> = {
//     [K in keyof T]: [keyof PickByValue<T, T[K]>, T[K]]
// }[keyof T][]

//
// TODO: Be much more sophisticated in handling typescript constraints on the
// helper functions below
//

export const reduceAssignToObject = (previous, item) => ({ ...previous, ...item })

//
// Applies map to the values of a key/value object
//
export const objectMap = (obj, transform) => Object.entries(obj)
    .map(([key, value]) => ({ [key]: transform(value) }))
    .reduce(reduceAssignToObject, {})

export const objectEntryMap = (obj, transform) => Object.entries(obj)
    .map(([key, value]) => ({ [key]: transform(key, value) }))
    .reduce(reduceAssignToObject, {})

export const reduceArrayToObject = (previous, [key, value]) => ({ ...previous, [key]: value })

//
// Applies filter to the values of a key/value object
//
export const objectFilter = (obj, condition) => Object.entries(obj)
    .filter(([_, value]) => (condition(value)))
    .reduce(reduceArrayToObject, {})

export const objectFilterEntries = (obj, condition) => Object.entries(obj)
    .filter(([key, value]) => (condition([key, value])))
    .reduce(reduceArrayToObject, {})

export const deepEqual = (objA, objB) => {
    if (objA === objB) {
        return true
    }
    if (Array.isArray(objA) && Array.isArray(objB)) {
        return (objA.length === objB.length) &&
            objA.every((item, index) => (deepEqual(item, objB[index])))
    }
    if (typeof objA === 'object' && typeof objB === 'object') {
        if (!deepEqual(Object.keys(objA).sort(), Object.keys(objB).sort())) {
            return false
        }
        return Object.entries(objA).every(([key, value]) => (deepEqual(value, objB?.[key])))
    }
    return false
}