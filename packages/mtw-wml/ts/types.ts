export type ArrayContents<T extends Array<any>> = T extends Array<infer G> ? G : never
