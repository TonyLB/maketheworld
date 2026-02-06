import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { EditWrappedStandardNode } from "../../standardize/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaEdit } from "@tonylb/mtw-base/ts/schema/edit"

//
// unwrapSubject takes a schema node that might be a replace or remove, and returns the first tag in the tree hierarchy
// that is *not* an edit tag (i.e., the subject content being edited)
//
export const unwrapSubject = <Extra extends {}>(node: GenericTreeNode<SchemaTag> | undefined): GenericTreeNode<SchemaTag> | undefined => {
    if (!node) { return undefined }
    if (treeNodeTypeguard(isSchemaEdit)(node)) {
        return unwrapSubject<Extra>(node.children[0])
    }
    return node
}

//
// deIndentWML is a test utility that allows writing deeply indented WML (suitable for nesting in an indented code block)
// and then removing the common number of indents to left-justify the block.
//
export const deIndentWML = (wml: string): string => {
    const deIndentAmount = wml.split('\n').reduce<number>((previous, line) => {
        if (!line.trim()) {
            return previous
        }
        const lineIndent = line.length - line.trim().length
        return Math.min(lineIndent, previous)
    }, Infinity)
    if (deIndentAmount === Infinity || deIndentAmount === 0) {
        return wml
    }
    return wml
        .split('\n')
        .filter((line) => (Boolean(line.trim())))
        .map((line) => (line.slice(deIndentAmount)))
        .join('\n')
}

export const wrappedNodeTypeGuard = <SubType extends SchemaTag>(typeGuard: (value: SchemaTag) => value is SubType) => (node: GenericTreeNode<SchemaTag>): node is EditWrappedStandardNode<SubType, SchemaTag> => {
    if (treeNodeTypeguard(isSchemaEdit)(node)) {
        return node.children.reduce((previous, child) => (previous && wrappedNodeTypeGuard<SubType>(typeGuard)(child)), true)
    }
    else {
        return typeGuard(node.data)
    }
}

export { findTaggedChildren } from './findTaggedChildren'
export { splitTaggedChildren } from './splitTaggedChildren'
export { splitChildrenByPredicate } from './splitChildrenByPredicate'
export { recurseIntoEditable } from './recurseIntoEditable'
export { transformNestedChildren } from './transformNestedChildren'

import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit"

/**
 * Strip wrapper tags from schema trees, handling Remove/Replace edit operations.
 * This function handles both cases:
 * 1. Wrapper tag at top level: <Tag><Remove>...</Remove></Tag>
 * 2. Edit tag at top level with wrapper inside: <Remove><Tag>...</Tag></Remove>
 * 
 * @param tree - The schema tree to process
 * @param expectedTag - The tag name to strip (e.g., 'Key', 'Parent', 'ShortName')
 * @returns The schema tree with the wrapper tag removed
 */
export const stripWrapperTag = (tree: GenericTree<SchemaTag>, expectedTag: SchemaTag["tag"]): GenericTree<SchemaTag> => {
    if (tree.length === 0) {
        return tree
    }
    
    const firstNode = tree[0]
    
    // Case 1: Wrapper tag at top level - strip it and return children
    if (firstNode.data.tag === expectedTag) {
        return firstNode.children
    }
    
    // Case 2: Remove tag at top level - strip wrapper tag from inside
    if (treeNodeTypeguard(isSchemaRemove)(firstNode)) {
        return [{
            data: firstNode.data,
            children: stripWrapperTag(firstNode.children, expectedTag)
        }]
    }
    
    // Case 3: Replace tag at top level - strip wrapper tag from ReplaceMatch and ReplacePayload children
    if (treeNodeTypeguard(isSchemaReplace)(firstNode)) {
        return [{
            data: firstNode.data,
            children: firstNode.children.map((child) => {
                return {
                    data: child.data,
                    children: stripWrapperTag(child.children, expectedTag)
                }
            })
        }]
    }
    
    // If we get here, the wrapper tag wasn't found at the expected location
    // This could be valid (already-stripped tree) or invalid (wrong tag)
    // We'll let the caller handle validation
    return tree
}