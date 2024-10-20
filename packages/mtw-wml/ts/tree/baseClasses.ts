export type GenericTreeNodeFiltered<F extends {}, N extends {}, Extra extends {} = {}> = {
    data: F;
    children: GenericTree<N, Extra>;
} & Omit<Extra, 'data' | 'children' >

export type GenericTreeNode<N extends {}, Extra extends {} = {}> = GenericTreeNodeFiltered<N, N, Extra>

export type GenericTreeFiltered<F extends {}, N extends {}, Extra extends {} = {}> = GenericTreeNodeFiltered<F, N, Extra>[]

export type GenericTree<N extends {}, Extra extends {} = {}> = GenericTreeFiltered<N, N, Extra>

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
    Parameters<Callback> extends [infer A extends {}, infer B extends {}]
        ? GenericTreeNode<A, B>
        : Parameters<Callback> extends [infer A extends {}]
            ? GenericTreeNode<A>
            : never

export const treeNodeTypeguard = <TreeType extends {}, SubType extends TreeType, Extra extends {}={}>(typeGuard: (value: TreeType) => value is SubType) => (node: GenericTreeNode<TreeType, Extra>): node is GenericTreeNodeFiltered<SubType, TreeType, Extra> => (typeGuard(node.data))
