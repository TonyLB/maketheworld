import { GenericTree } from "../../sequence/tree/baseClasses"
import { SchemaTag } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectImages = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .reordered([options.tag, 'If', 'Image'])
        .filter({ classes: ['Image'] })
        .prune([{ not: ['If', 'Image' ] }])
        .tree
}