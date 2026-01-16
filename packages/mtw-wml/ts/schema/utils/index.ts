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
export { recurseIntoEditable } from './recurseIntoEditable'
export { transformNestedChildren } from './transformNestedChildren'