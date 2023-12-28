import { GenericTree } from "../../sequence/tree/baseClasses"
import { SchemaTag } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

//
// TODO: Create tree filter and apply a SchemaMessage typeguard to guarantee a GenericTree<SchemaTaggedMessage...> type
//
export const selectRender = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    //
    // TODO: Create a separate Bookmark render, which doesn't prune internal bookmarks
    //
    return tagTree
        .reordered([options.tag, 'Description', 'If'])
        .filtered({ classes: ['Description'], prune: ['Asset', options.tag, 'Description']})
        .tree
}