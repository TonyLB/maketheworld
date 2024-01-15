export type GenericTreeNodeFiltered<F extends {}, N extends {}> = {
    data: F;
    children: GenericTree<N>;
}

export type GenericTreeNode<N extends {}> = GenericTreeNodeFiltered<N, N>

export type GenericTreeFiltered<F extends {}, N extends {}> = GenericTreeNodeFiltered<F, N>[]

export type GenericTree<N extends {}> = GenericTreeFiltered<N, N>

export enum GenericTreeDiffAction {
    Exclude,
    Context,
    Set,
    Add,
    Delete
}

export type GenericTreeDiffNode<N extends {}> = {
    data: N;
    children: GenericTreeDiff<N>;
    action: GenericTreeDiffAction;
}

export type GenericTreeDiff<N extends {}> = GenericTreeDiffNode<N>[]

export type SourceWrap<N extends {}> = {
    contents: N;
    source: string;
}

export type GenericTreeIDNode<N extends {}> = {
    data: N;
    id: string;
    children: GenericTreeID<N>;
}

export type GenericTreeID<N extends {}> = GenericTreeIDNode<N>[]
