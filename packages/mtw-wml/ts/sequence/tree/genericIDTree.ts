import { v4 as uuidv4 } from 'uuid'
import { GenericTree, GenericTreeID } from "./baseClasses"

export const genericIDFromTree = <N extends {}>(tree: GenericTree<N>): GenericTreeID<N> => (
    tree.map(({ data, children }) => ({
        data,
        children: genericIDFromTree(children),
        id: uuidv4()
    }))
)
