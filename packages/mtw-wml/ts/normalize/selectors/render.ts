import { GenericTree } from "../../sequence/tree/baseClasses"
import { SchemaBookmarkTag, SchemaMessageTag, SchemaTag, isSchemaBookmark } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

//
// TODO: Create tree filter and apply a SchemaMessage typeguard to guarantee a GenericTree<SchemaTaggedMessage...> type
//
export const selectRender = (tree: GenericTree<SchemaTag>, options={ tag: '', key: '' }): GenericTree<SchemaTag> => {
    if (!options.tag) {
        return []
    }
    const tagTree = new SchemaTagTree(tree)
    if (options.tag === 'Bookmark') {
        const matchTag: SchemaBookmarkTag = { tag: 'Bookmark', key: options.key }
        return tagTree
            .reordered([options.tag, 'If'])
            .prune([{ before: matchTag }, { match: matchTag }, { after: (node) => (isSchemaBookmark(node) && node.key !== options.key) }])
            .tree
    }
    else if (options.tag === 'Message') {
        const matchTag: SchemaMessageTag = { tag: 'Message', key: options.key, rooms: [] }
        return tagTree
            .reordered([options.tag, 'If'])
            .filter([{ not: ['Room'] }])
            .prune([{ before: matchTag }, { match: matchTag }])
            .tree
    }
    else {
        return tagTree
            .reordered([options.tag, 'Description', 'If'])
            .filter([{ match: 'Description' }])
            .prune([{ before: 'Description' }, { match: 'Description' }])
            .tree
    }
}