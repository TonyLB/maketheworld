import { GenericTree } from "../../tree/baseClasses"
import { SchemaTag } from "../../schema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectMapRooms = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .reordered([options.tag, 'If', 'Room', 'Position'])
        .filter({ match: 'Position' })
        .prune({ not: { or: [{ match: 'If' }, { match: 'Room' }, { match: 'Position' }] }})
        .tree
}