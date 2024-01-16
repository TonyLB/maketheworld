export type GenericTreeNodeFiltered<F extends {}, N extends {}, Extra extends {} = {}> = {
    data: F;
    children: GenericTree<N, Extra>;
} & Omit<Extra, 'data' | 'children' >

export type GenericTreeNode<N extends {}, Extra extends {} = {}> = GenericTreeNodeFiltered<N, N, Extra>

export type GenericTreeFiltered<F extends {}, N extends {}, Extra extends {} = {}> = GenericTreeNodeFiltered<F, N, Extra>[]

export type GenericTree<N extends {}, Extra extends {} = {}> = GenericTreeFiltered<N, N, Extra>

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

export type GenericTreeIDNode<N extends {}> = GenericTreeNode<N, { id: string }>

export type GenericTreeID<N extends {}> = GenericTreeIDNode<N>[]
