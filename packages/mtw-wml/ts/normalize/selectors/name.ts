import { GenericTree } from "../../sequence/tree/baseClasses"
import { SchemaTag } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

//
// TODO: Create tree filter and apply a SchemaMessage typeguard to guarantee a GenericTree<SchemaTaggedMessage...> type
//
export const selectName = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .reordered([options.tag, 'Name', 'If'])
        .filter({ match: 'Name' })
        .prune({ or: [{ before: 'Name' }, { match: 'Name' }] })
        .tree
}