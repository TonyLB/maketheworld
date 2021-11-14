export type FlatTreeAncestor = {
    key?: string;
    position: number;
}

export type FlatTreeRow<T extends {}> = {
    key: string;
    item: T;
    level: number;
    open?: boolean;
    verticalRows?: number;
    draggingSource?: boolean;
    draggingTarget?: boolean;
    draggingPoints: FlatTreeAncestor[];
}

export type FlatTree<T extends {}> = FlatTreeRow<T>[]

export type NestedTreeEntry<T extends {}> = {
    key: string;
    item: T;
    children: NestedTree<T>;
    open?: boolean;
    draggingSource?: boolean;
    draggingTarget?: boolean;
}

export type NestedTree<T extends {}> = NestedTreeEntry<T>[]
