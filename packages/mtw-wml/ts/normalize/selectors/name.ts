import { GenericTree } from "../../tree/baseClasses"
import { treeTypeGuard } from "../../tree/filter"
import { SchemaOutputTag, SchemaTag, isSchemaOutputTag } from "../../schema/baseClasses"
import { schemaOutputToString } from "../../schema/utils/schemaOutput/schemaOutputToString"
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
            .reordered([options.tag, 'Name', 'If'])
            .filter({ match: 'Name' })
            .prune({ or: [{ before: { match: 'Name' } }, { match: 'Name' }] })
            .tree,
        typeGuard: isSchemaOutputTag
    }))
}
