import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"

//
// recurseIntoEditable takes a node that may be edit-wrapped (Remove or Replace)
// and applies a function to the actual content nodes within the wrapper.
//
// Returns an array of results:
// - Plain node: single result from applying the function to the node itself
// - Remove node: single result from applying the function to the content within Remove
// - Replace node: two results - one from ReplaceMatch content, one from ReplacePayload content
//
export const recurseIntoEditable = <T>(
    node: GenericTreeNode<SchemaTag>,
    fn: (contentNode: GenericTreeNode<SchemaTag>) => T
): T[] => {
    // Plain node - apply function directly
    if (!treeNodeTypeguard(isSchemaRemove)(node) && !treeNodeTypeguard(isSchemaReplace)(node)) {
        return [fn(node)]
    }
    
    // Remove node - apply function to the content within Remove
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        // Remove contains the content to be removed - apply function to that content
        return node.children.map(fn)
    }
    
    // Replace node - apply function to both ReplaceMatch and ReplacePayload content
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const results: T[] = []
        
        // Process ReplaceMatch (old content)
        const replaceMatch = node.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
        if (replaceMatch) {
            results.push(...replaceMatch.children.map(fn))
        }
        
        // Process ReplacePayload (new content)
        const replacePayload = node.children.find(treeNodeTypeguard(isSchemaReplacePayload))
        if (replacePayload) {
            results.push(...replacePayload.children.map(fn))
        }
        
        return results
    }
    
    // Fallback (shouldn't reach here, but TypeScript needs it)
    return []
}
