export type FlatTreeRow<T extends {}> = T & {
    level: number;
}

export type FlatTree<T extends {}> = FlatTreeRow<T>[]

export type NestedTreeEntry<T extends {}> = T & {
    children: NestedTree<T>;
}

export type NestedTree<T extends {}> = NestedTreeEntry<T>[]
