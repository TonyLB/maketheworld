import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { TagMismatchError } from "@tonylb/mtw-base/ts/standardize"

//
// transformNestedChildren is a curried helper function that transforms the children of a semantic node,
// handling edit structures (Remove/Replace) by unwrapping, transforming, and re-wrapping.
//
// If tag is specified, validates that the semantic node (after unwrapping) matches that tag.
// Always applies the transform function - callers handle any early returns.
//
export const transformNestedChildren = <T extends SchemaTag = SchemaTag>(options: {
    tag?: T["tag"],
    transform: (children: GenericTree<SchemaTag>) => GenericTree<SchemaTag>
}) => (node: GenericTreeNode<SchemaTag>): GenericTreeNode<SchemaTag> => {
    const { tag, transform } = options

    // Handle Remove-wrapped nodes
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        if (!node.children || node.children.length === 0) {
            throw new Error('Remove node has no children')
        }
        const innerNode = node.children[0]
        
        // Validate tag if specified
        if (tag && innerNode.data.tag !== tag) {
            throw new TagMismatchError(tag, innerNode.data.tag)
        }
        
        // Transform the inner node's children
        const transformedChildren = transform(innerNode.children)
        
        // Re-wrap in Remove
        return {
            data: node.data,
            children: [{
                ...innerNode,
                children: transformedChildren
            }]
        }
    }

    // Handle Replace-wrapped nodes
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const replaceMatch = node.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
        const replacePayload = node.children.find(treeNodeTypeguard(isSchemaReplacePayload))
        
        if (!replaceMatch || !replacePayload) {
            throw new Error('Replace node must have both ReplaceMatch and ReplacePayload children')
        }
        
        if (replaceMatch.children.length === 0 || replacePayload.children.length === 0) {
            throw new Error('ReplaceMatch and ReplacePayload must have children')
        }
        
        const matchInnerNode = replaceMatch.children[0]
        const payloadInnerNode = replacePayload.children[0]
        
        // Validate tag if specified (both match and payload should have same tag)
        if (tag) {
            if (matchInnerNode.data.tag !== tag) {
                throw new TagMismatchError(tag, matchInnerNode.data.tag)
            }
            if (payloadInnerNode.data.tag !== tag) {
                throw new TagMismatchError(tag, payloadInnerNode.data.tag)
            }
        }
        
        // Transform both match and payload inner nodes' children
        const transformedMatchChildren = transform(matchInnerNode.children)
        const transformedPayloadChildren = transform(payloadInnerNode.children)
        
        // Re-wrap in Replace structure
        return {
            data: node.data,
            children: [
                {
                    data: replaceMatch.data,
                    children: [{
                        ...matchInnerNode,
                        children: transformedMatchChildren
                    }]
                },
                {
                    data: replacePayload.data,
                    children: [{
                        ...payloadInnerNode,
                        children: transformedPayloadChildren
                    }]
                }
            ]
        }
    }

    // Handle plain nodes
    // Validate tag if specified
    if (tag && node.data.tag !== tag) {
        throw new TagMismatchError(tag, node.data.tag)
    }
    
    // Transform children directly
    const transformedChildren = transform(node.children)
    
    return {
        ...node,
        children: transformedChildren
    }
}
