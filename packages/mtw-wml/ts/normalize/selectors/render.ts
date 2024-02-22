import { GenericTree } from "../../tree/baseClasses"
import { treeTypeGuard } from "../../tree/filter"
import { SchemaBookmarkTag, SchemaMessageTag, SchemaOutputTag, SchemaTag, isSchemaBookmark, isSchemaOutputTag } from "../../schema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectRender = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaOutputTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    if (options.tag === 'Bookmark') {
        const matchTag: SchemaBookmarkTag = { tag: 'Bookmark', key: options.key }
        return treeTypeGuard({
            tree: tagTree
                .reordered([{ match: options.tag }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }])
                .prune({ or: [{ before: { match: { data: matchTag } } }, { match: { data: matchTag } }, { after: { match: ({ data: node }) => (isSchemaBookmark(node) && node.key !== options.key) } }] })
                .tree,
            typeGuard: isSchemaOutputTag
        })
    }
    else if (options.tag === 'Message') {
        const matchTag: SchemaMessageTag = { tag: 'Message', key: options.key }
        return treeTypeGuard({
            tree: tagTree
                .reordered([{ match: options.tag }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }])
                .filter({ not: { match: 'Room' } })
                .prune({ or: [{ before: { match: { data: matchTag } } }, { match: { data: matchTag } }]})
                .tree,
            typeGuard: isSchemaOutputTag
        })
    }
    else {
        return treeTypeGuard({
            tree: tagTree
                .reordered([{ match: options.tag }, { match: 'Description' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }])
                .filter({ match: 'Description' })
                .prune({ or: [{ before: { match: 'Description' } }, { match: 'Description' }]})
                .tree,
            typeGuard: isSchemaOutputTag
        })
    }
}