import { GenericTree } from "../../tree/baseClasses"
import { treeTypeGuard } from "../../tree/filter"
import { SchemaOutputTag, SchemaTag, isSchemaOutputTag } from "../baseClasses"
import { schemaOutputToString } from "../utils/schemaOutput/schemaOutputToString"
import SchemaTagTree from "../../tagTree/schema"
import { optionsMatch } from "./utils"

export const selectName = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaOutputTag> => {
    if (!options.tag) {
        const tagTree = new SchemaTagTree(tree)
        return treeTypeGuard({
            tree: tagTree
                .filter({ match: 'Name' })
                .reordered([{ match: 'Name' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                .prune({ or: [{ before: { match: 'Name' } }, { match: 'Name' }] })
                .tree,
            typeGuard: isSchemaOutputTag
        })
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
        const tagTree = new SchemaTagTree(tree)
        return schemaOutputToString(treeTypeGuard({
            tree: tagTree
                .filter({ match: 'Name' })
                .reordered([{ match: 'Name' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                .prune({ or: [{ before: { match: 'Name' } }, { match: 'Name' }] })
                .tree,
            typeGuard: isSchemaOutputTag
        }))
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

export const selectShortName = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaOutputTag> => {
    if (!options.tag) {
        const tagTree = new SchemaTagTree(tree)
        return treeTypeGuard({
            tree: tagTree
                .filter({ match: 'ShortName' })
                .reordered([{ match: 'ShortName' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                .prune({ or: [{ before: { match: 'ShortName' } }, { match: 'ShortName' }] })
                .tree,
            typeGuard: isSchemaOutputTag
        })
    }
    const tagTree = new SchemaTagTree(tree)
    return treeTypeGuard({
        tree: tagTree
            .filter({ and: [{ match: optionsMatch(options) }, { match: 'ShortName' }] })
            .reordered([{ match: options.tag }, { match: 'ShortName' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
            .prune({ or: [{ before: { match: 'ShortName' } }, { match: 'ShortName' }] })
            .tree,
        typeGuard: isSchemaOutputTag
    })
}
