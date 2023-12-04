export type GenericTreeNode<N extends {}> = {
    data: N;
    children: GenericTree<N>;
}

export type GenericTree<N extends {}> = GenericTreeNode<N>[]

export enum GenericTreeDiffAction {
    Exclude,
    Context,
    Set,
    Add,
    Delete
}

export type GenericTreeDiffNode<N extends {}> = GenericTreeNode<N> & {
    action: GenericTreeDiffAction;
}

export type GenericTreeDiff<N extends {}> = GenericTreeDiffNode<N>[]

export type SourceWrap<N extends {}> = {
    contents: N;
    source: string;
}
