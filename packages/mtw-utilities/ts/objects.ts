//
// Some Typescript helper functions to deal with Object.entries typing in cases
// when we no that no excess values will be included
//
// Borrowed from: https://stackoverflow.com/questions/60141960/typescript-key-value-relation-preserving-object-entries-type
//
type PickByValue<T, V> = Pick<T, { [K in keyof T]: T[K] extends V ? K : never }[keyof T]>
export type Entries<T> = {
    [K in keyof T]: [keyof PickByValue<T, T[K]>, T[K]]
}[keyof T][]

type ObjectMap = Record<string, any>
type ConstrainedMap<T> = Record<string, T>

export const reduceAssignToObject = (previous: Record<string, any>, item: Record<string, any>): ObjectMap => ({ ...previous, ...item })

//
// Applies map to the values of a key/value object
//
export const objectMap = <T, M>(obj: ConstrainedMap<T>, transform: ((value: T) => M)): ConstrainedMap<M> => Object.entries(obj)
    .map(([key, value]) => ({ [key]: transform(value) }))
    .reduce(reduceAssignToObject, {})

export const objectEntryMap = <T, M>(obj: ConstrainedMap<T>, transform: (key: string, value: T) => M): ConstrainedMap<M> => Object.entries(obj)
    .map(([key, value]) => ({ [key]: transform(key, value) }))
    .reduce(reduceAssignToObject, {})

export const reduceArrayToObject = (previous: ObjectMap, [key, value]: [string, any]): ObjectMap => ({ ...previous, [key]: value })

//
// Applies filter to the values of a key/value object
//
type TypeGuard<T, G extends T> = (value: T) => value is G
export const objectFilter = <T, V extends (value: T) => boolean>(obj: ConstrainedMap<T>, condition: V): V extends TypeGuard<T, infer G> ? ConstrainedMap<G> : ConstrainedMap<T> => (Object.entries(obj) as [string, T][])
    .filter(([_, value]) => (condition(value)))
    .reduce(reduceArrayToObject, {}) as V extends ((value: T) => value is infer G extends T) ? ConstrainedMap<G> : ConstrainedMap<T>

export const objectFilterEntries = <T, V extends (props: [string, T]) => boolean>(obj: ConstrainedMap<T>, condition: V): ConstrainedMap<T> => Object.entries(obj)
    .filter(([key, value]) => (condition([key, value])))
    .reduce(reduceArrayToObject, {})

export const deepEqual = (objA: any, objB: any): boolean => {
    if (objA === objB) {
        return true
    }
    if (Array.isArray(objA) && Array.isArray(objB)) {
        return (objA.length === objB.length) &&
            objA.every((item, index) => (deepEqual(item, objB[index])))
    }
    if (typeof objA === 'object' && typeof objB === 'object') {
        if (!deepEqual(Object.keys(objA as Record<string, any>).sort(), Object.keys(objB as Record<string, any>).sort())) {
            return false
        }
        return Object.entries(objA as Record<string, any>).every(([key, value]) => (deepEqual(value, objB?.[key])))
    }
    return false
}