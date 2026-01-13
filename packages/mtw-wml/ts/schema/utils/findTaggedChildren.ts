import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"

//
// semanticallyRepresentsTag checks if a node semantically represents a given tag,
// considering Remove and Replace wrappers. Only checks direct children (one level deep).
//
const semanticallyRepresentsTag = (node: GenericTreeNode<SchemaTag>, tag: SchemaTag["tag"]): boolean => {
    // Direct match
    if (node.data.tag === tag) {
        return true
    }
    
    // Remove wrapper - check if any direct child matches the tag
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        return node.children.some(child => child.data.tag === tag)
    }
    
    // Replace wrapper - check if ReplaceMatch or ReplacePayload contain the tag in their direct children
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        return node.children.some(child => {
            if (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)) {
                return child.children.some(grandchild => grandchild.data.tag === tag)
            }
            return false
        })
    }
    
    return false
}

//
// findTaggedChildren finds all direct children of a node that semantically represent a given tag,
// even if they are wrapped in Remove or Replace tags. Wrappers are preserved in the results.
//
export const findTaggedChildren = (args: { children: GenericTree<SchemaTag>, tag: SchemaTag["tag"] }): GenericTree<SchemaTag> => {
    return args.children.filter(node => semanticallyRepresentsTag(node, args.tag))
}
