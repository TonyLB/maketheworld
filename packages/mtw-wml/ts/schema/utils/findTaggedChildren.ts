import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"

//
// semanticallyRepresentsTag checks if a node semantically represents a given tag,
// considering Remove and Replace wrappers. Only checks direct children (one level deep).
// Exported for use by splitTaggedChildren.
//
export const semanticallyRepresentsTag = (node: GenericTreeNode<SchemaTag>, tag: SchemaTag["tag"]): boolean => {
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
    return args.children
        .filter(node => semanticallyRepresentsTag(node, args.tag))
        .map(node => {
            // If this is a Remove node containing the target tag, filter its children to only include matching ones
            if (treeNodeTypeguard(isSchemaRemove)(node)) {
                const matchingChildren = node.children.filter(child => child.data.tag === args.tag)
                if (matchingChildren.length > 0) {
                    return {
                        data: node.data,
                        children: matchingChildren
                    }
                }
            }
            // If this is a Replace node containing the target tag, filter ReplaceMatch/ReplacePayload children
            // Note: We preserve both ReplaceMatch and ReplacePayload even if empty, to maintain valid Replace structure
            if (treeNodeTypeguard(isSchemaReplace)(node)) {
                const filteredChildren = node.children.map(child => {
                    if (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)) {
                        const matchingGrandchildren = child.children.filter(grandchild => grandchild.data.tag === args.tag)
                        // Always preserve ReplaceMatch/ReplacePayload structure, even if empty
                        return {
                            data: child.data,
                            children: matchingGrandchildren
                        }
                    }
                    return child
                })
                return {
                    data: node.data,
                    children: filteredChildren
                }
            }
            // For direct matches, return as-is
            return node
        })
}
