import { GenericTree, GenericTreeNode } from "./baseClasses";

export const map = <T extends {}, O extends {}>(tree: GenericTree<T>, callback: (incoming: { data: T, children: GenericTree<O> }) => GenericTree<O>): GenericTree<O> => {
    return tree.map(({ data, children }) => (callback({ data, children: map(children, callback) }))).flat(1)
}

export const asyncMap = async <T extends {}, O extends {}>(tree: GenericTree<T>, callback: (incoming: { data: T, children: GenericTree<O> }) => Promise<GenericTree<O>>): Promise<GenericTree<O>> => {
    return (await Promise.all(tree.map(async ({ data, children }) => (await callback({ data, children: await asyncMap(children, callback) }))))).flat(1)
}
