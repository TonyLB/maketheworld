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

export const reduceAssignToObject = (previous: Record<string, any>, item: Record<string, any>) => ObjectMap

export const objectMap: <T, M>(obj: ConstrainedMap<T>, transform: ((value: T) => M)) => ConstrainedMap<M>

export const objectEntryMap: <T, M>(obj: ConstrainedMap<T>, transform: (key: string, value: T) => M) => ConstrainedMap<M>

export const reduceArrayToObject: (previous: ObjectMap, [key, value]: [string, any]) => ObjectMap

export const objectFilter: <T, V extends (value: T) => boolean>(obj: ConstrainedMap<T>, condition: V) => V extends ((value: T) => value is infer G) ? ConstrainedMap<G> : ConstrainedMap<T>

export const objectFilterEntries: <T, V extends (props: [string, T]) => boolean>(obj: ConstrainedMap<T>, condition: V) => ConstrainedMap<T>

export const deepEqual: <T extends any>(objA: T, objB: T) => boolean
