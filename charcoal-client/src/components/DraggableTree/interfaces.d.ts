export type FlatTreeRow<T extends {}> = T & {
    level: number;
    open?: boolean;
    verticalRows: number;
}

export type FlatTree<T extends {}> = FlatTreeRow<T>[]

export type NestedTreeEntry<T extends {}> = T & {
    children: NestedTree<T>;
    open?: boolean;
}

export type NestedTree<T extends {}> = NestedTreeEntry<T>[]
