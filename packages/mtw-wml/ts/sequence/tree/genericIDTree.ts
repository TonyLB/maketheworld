import { v4 as uuidv4 } from 'uuid'
import { GenericTree, TreeId } from "./baseClasses"

export const genericIDFromTree = <N extends {}>(tree: GenericTree<N>): GenericTree<N, TreeId> => (
    tree.map(({ data, children }) => ({
        data,
        children: genericIDFromTree(children),
        id: uuidv4()
    }))
)

export const stripIDFromTree = <N extends {}>(tree: GenericTree<N, TreeId>): GenericTree<N> => (
    tree.map(({ data, children }) => ({
        data,
        children: stripIDFromTree(children)
    }))
)
