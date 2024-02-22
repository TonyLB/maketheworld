import { GenericTree } from "../../tree/baseClasses"
import { SchemaTag } from "../../schema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectExits = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Exit' }])
        .filter({ match: 'Exit' })
        .prune({ not: { or: [{ match: 'If' }, { match: 'Exit' }, { after: { match: 'Exit' } }] }})
        .tree
}