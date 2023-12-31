import { GenericTree } from "../../sequence/tree/baseClasses"
import { SchemaTag } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectExits = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .reordered(['If', 'Exit'])
        .filter([{ match: 'Exit' }])
        .prune([{ not: ['If', 'Exit' ] }])
        .tree
}