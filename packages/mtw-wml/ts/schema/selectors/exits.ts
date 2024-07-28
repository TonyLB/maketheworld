import { GenericTree } from "../../tree/baseClasses"
import { SchemaTag } from "../baseClasses"
import SchemaTagTree from "../../tagTree/schema"
import { optionsMatch } from "./utils"

export const selectExits = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .filter({ and: [{ match: optionsMatch(options) }, { match: 'Exit' }] })
        .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Exit' }])
        .prune({ not: { or: [{ match: 'If' }, { match: 'Exit' }, { after: { match: 'Exit' } }] }})
        .tree
}