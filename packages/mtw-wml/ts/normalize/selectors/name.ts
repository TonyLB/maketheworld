import { GenericTree } from "../../sequence/tree/baseClasses"
import { treeTypeGuard } from "../../sequence/tree/filter"
import { SchemaOutputTag, SchemaTag, isSchemaOutputTag } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectName = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaOutputTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    return treeTypeGuard({
        tree: tagTree
            .reordered([options.tag, 'Name', 'If'])
            .filter({ match: 'Name' })
            .prune({ or: [{ before: 'Name' }, { match: 'Name' }] })
            .tree,
        typeGuard: isSchemaOutputTag
    })
}