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

export const objectMap = (obj: Record<string, any>, transform: (value: any) => any) => ObjectMap

export const objectEntryMap = (obj: Record<string, any>, transform: (key: any, value: any) => any) => ObjectMap

export const reduceArrayToObject = (previous: Record<string, any>, [key, value]: [string, any]) => ObjectMap

export const objectFilter: <T>(obj: ConstrainedMap<T>, condition: (value: T) => boolean) => ConstrainedMap<T>
