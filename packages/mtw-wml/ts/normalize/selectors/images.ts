import { GenericTree } from "../../tree/baseClasses"
import { SchemaTag } from "../../schema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectImages = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .reordered([{ match: options.tag }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Image' }])
        .filter({ match: 'Image' })
        .prune({ not: { or: [{ match: 'If' }, { match: 'Image' }] }})
        .tree
}