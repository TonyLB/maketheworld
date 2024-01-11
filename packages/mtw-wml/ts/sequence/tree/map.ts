import { GenericTree, GenericTreeNode } from "./baseClasses";

export const map = <T extends {}, O extends {}>(tree: GenericTree<T>, callback: (incoming: { data: T, children: GenericTree<O> }) => GenericTreeNode<O>): GenericTree<O> => {
    return tree.map(({ data, children }) => (callback({ data, children: map(children, callback) })))
}
