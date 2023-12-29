import { GenericTree } from "../../sequence/tree/baseClasses"
import { SchemaTag } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectMapRooms = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    //
    // TODO: Create a separate Bookmark render, which doesn't prune internal bookmarks
    //
    return tagTree
        .reordered([options.tag, 'If', 'Room'])
        .filtered({ classes: ['Room'], prune: ['Asset', options.tag]})
        .tree
}