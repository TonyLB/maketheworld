export type GenericTreeNode<N extends {}> = {
    data: N;
    children: GenericTree<N>;
}

export type GenericTree<N extends {}> = GenericTreeNode<N>[]

