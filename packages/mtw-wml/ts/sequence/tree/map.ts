import { GenericTree } from "./baseClasses";

export const map = <T extends {}, O extends {}>(tree: GenericTree<T>, callback: (incoming: T) => O): GenericTree<O> => {
    return tree.map(({ data, children }) => ({
        data: callback(data),
        children: map(children, callback)
    }))
}
