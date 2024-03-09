import { GenericTree } from "../../tree/baseClasses"
import { treeTypeGuard } from "../../tree/filter"
import { SchemaOutputTag, SchemaTag, isSchemaOutputTag } from "../../schema/baseClasses"
import { schemaOutputToString } from "../../schema/utils/schemaOutput/schemaOutputToString"
import SchemaTagTree from "../../tagTree/schema"
import { optionsMatch } from "./utils"

export const selectName = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaOutputTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    return treeTypeGuard({
        tree: tagTree
            .filter({ and: [{ match: optionsMatch(options) }, { match: 'Name' }] })
            .reordered([{ match: options.tag }, { match: 'Name' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
            .prune({ or: [{ before: { match: 'Name' } }, { match: 'Name' }] })
            .tree,
        typeGuard: isSchemaOutputTag
    })
}

export const selectNameAsString = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): string => {
    if (!options.tag) {
        return ''
    }
    const tagTree = new SchemaTagTree(tree)
    return schemaOutputToString(treeTypeGuard({
        tree: tagTree
            .filter({ and: [{ match: optionsMatch(options) }, { match: 'Name' }] })
            .reordered([{ match: options.tag }, { match: 'Name' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
            .prune({ or: [{ before: { match: 'Name' } }, { match: 'Name' }] })
            .tree,
        typeGuard: isSchemaOutputTag
    }))
}
