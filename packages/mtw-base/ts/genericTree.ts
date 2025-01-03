export type GenericTreeNodeFiltered<F extends {}, N extends {}> = {
    data: F;
    children: GenericTree<N>;
}

export type GenericTreeNode<N extends {}> = GenericTreeNodeFiltered<N, N>

export type GenericTreeFiltered<F extends {}, N extends {}> = GenericTreeNodeFiltered<F, N>[]

export type GenericTree<N extends {}> = GenericTreeFiltered<N, N>

export type GenericTreeNodeExtended<N extends {}, Extra extends {}> = {
    data: N;
    children: GenericTreeNodeExtended<N, Extra>[];
} & Extra

export type GenericTreeExtended<N extends {}, Extra extends {}> = GenericTreeNodeExtended<N, Extra>[]

export type GenericTreeWithUndefined<N extends {}> = GenericTreeNodeWithUndefined<N>[]

export type GenericTreeNodeWithUndefined<N extends{}> = undefined | {
    data: N;
    children: GenericTreeWithUndefined<N>;
}

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

export type TreeCallback<T> =
    ((data) => T) |
    ((data, extra) => T)

export type TreeCallbackNode<Callback extends TreeCallback<any>> = 
    Parameters<Callback> extends [infer A extends {}]
        ? GenericTreeNode<A>
        : never

export const treeNodeTypeguard = <TreeType extends {}, SubType extends TreeType, Extra extends {}={}>(typeGuard: (value: TreeType) => value is SubType) => (node: GenericTreeNode<TreeType>): node is GenericTreeNodeFiltered<SubType, TreeType> => (typeGuard(node.data))
