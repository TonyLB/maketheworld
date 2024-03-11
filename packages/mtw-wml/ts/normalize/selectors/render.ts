import { GenericTree } from "../../tree/baseClasses"
import { treeTypeGuard } from "../../tree/filter"
import { SchemaBookmarkTag, SchemaMessageTag, SchemaOutputTag, SchemaTag, isSchemaBookmark, isSchemaOutputTag } from "../../schema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"
import { optionsMatch } from "./utils"

export const selectRender = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaOutputTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    if (options.tag === 'Bookmark') {
        const matchTag: SchemaBookmarkTag = { tag: 'Bookmark', key: options.key }
        return treeTypeGuard({
            tree: tagTree
                .filter({ match: optionsMatch(options) })
                .reordered([{ match: options.tag }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                .prune({ or: [{ before: { match: { data: matchTag } } }, { match: { data: matchTag } }, { after: { match: ({ data: node }) => (isSchemaBookmark(node) && node.key !== options.key) } }] })
                .tree,
            typeGuard: isSchemaOutputTag
        })
    }
    else if (options.tag === 'Message') {
        const matchTag: SchemaMessageTag = { tag: 'Message', key: options.key }
        return treeTypeGuard({
            tree: tagTree
                .filter({ match: optionsMatch(options) })
                .reordered([{ match: options.tag }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                .filter({ not: { match: 'Room' } })
                .prune({ or: [{ before: { match: { data: matchTag } } }, { match: { data: matchTag } }]})
                .tree,
            typeGuard: isSchemaOutputTag
        })
    }
    else {
        return treeTypeGuard({
            tree: tagTree
                .filter({ and: [{ match: optionsMatch(options) }, { match: 'Description' }] })
                .reordered([{ match: options.tag }, { match: 'Description' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                .prune({ or: [{ before: { match: 'Description' } }, { match: 'Description' }]})
                .tree,
            typeGuard: isSchemaOutputTag
        })
    }
}

export const selectSummary = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaOutputTag> => {
    if (!options.tag) {
        const tagTree = new SchemaTagTree(tree)
        return treeTypeGuard({
            tree: tagTree
                .filter({ match: 'Summary' })
                .reordered([{ match: 'Summary' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                .prune({ or: [{ before: { match: 'Summary' } }, { match: 'Summary' }] })
                .tree,
            typeGuard: isSchemaOutputTag
        })
    }
    const tagTree = new SchemaTagTree(tree)
    return treeTypeGuard({
        tree: tagTree
            .filter({ and: [{ match: optionsMatch(options) }, { match: 'Summary' }] })
            .reordered([{ match: options.tag }, { match: 'Summary' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
            .prune({ or: [{ before: { match: 'Summary' } }, { match: 'Summary' }] })
            .tree,
        typeGuard: isSchemaOutputTag
    })
}
