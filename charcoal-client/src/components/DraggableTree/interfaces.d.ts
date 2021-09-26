export type FlatTreeRow<T extends {}> = {
    item: T;
    level: number;
    open?: boolean;
    verticalRows?: number;
    draggingSource?: boolean;
    draggingTarget?: boolean;
}

export type FlatTree<T extends {}> = FlatTreeRow<T>[]

export type NestedTreeEntry<T extends {}> = {
    item: T;
    children: NestedTree<T>;
    open?: boolean;
    draggingSource?: boolean;
    draggingTarget?: boolean;
}

export type NestedTree<T extends {}> = NestedTreeEntry<T>[]
