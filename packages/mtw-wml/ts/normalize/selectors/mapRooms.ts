import { GenericTree } from "../../sequence/tree/baseClasses"
import { SchemaTag } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectMapRooms = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    //
    // TODO: Create prune { type: 'After' } options in filtered, and use that to prune out all the
    // children after Room.
    //
    return tagTree
        .reordered([options.tag, 'If', 'Room'])
        .filter({ classes: ['Room'], prune: ['Asset', options.tag, 'Description', 'Exit', 'Name']})
        .tree
}