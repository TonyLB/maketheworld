import { v4 as uuidv4 } from 'uuid'
import { GenericTree, TreeId } from "./baseClasses"
import dfsWalk from './dfsWalk'

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

export const treeFindByID = <N extends {}>(tree: GenericTree<N, TreeId>, id: string): N | undefined => {
    return dfsWalk({
        callback: (previous: { output: N | undefined, state: {} }, data: N, extra: TreeId) => (
            extra.id === id ? { output: data, state: {} } : previous
        ),
        default: { output: undefined, state: {} }
    })(tree)
}