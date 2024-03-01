import { v4 as uuidv4 } from 'uuid'
import { GenericTree, GenericTreeNode, TreeId } from "./baseClasses"
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

export const treeFindByID = <N extends {}>(tree: GenericTree<N, TreeId>, id: string): GenericTreeNode<N, TreeId> | undefined => {
    return tree.reduce<GenericTreeNode<N, TreeId> | undefined>((previous, node) => {
        if (previous) {
            return previous
        }
        if (node.id === id) {
            return node
        }
        return treeFindByID(node.children, id)
    }, undefined)
}