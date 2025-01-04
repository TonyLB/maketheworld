import { isSchemaTaggedMessageLegalContents, SchemaTag, SchemaTaggedMessageLegalContents } from "@tonylb/mtw-base/ts/schema"
import { EditWrappedStandardNode } from "../../standardize/baseClasses"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaDescription, isSchemaName } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaCondition } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaEdit, isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit"

export const extractNameFromContents = (contents: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    return contents.map((item) => {
        if (isSchemaName(item.data)) {
            return item.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data)))
        }
        if (isSchemaCondition(item.data)) {
            const children = extractNameFromContents(item.children)
            if (children.length) {
                const conditionGroup = {
                    ...item,
                    children
                } as GenericTreeNodeFiltered<SchemaTaggedMessageLegalContents, SchemaTag>
                return [conditionGroup]
            }
        }
        return []
    }).flat(1)
}

export const extractDescriptionFromContents = (contents: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    const returnValue = contents.map((item) => {
        if (isSchemaDescription(item.data)) {
            return item.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data)))
        }
        if (isSchemaCondition(item.data)) {
            const children = extractDescriptionFromContents(item.children)
            if (children.length) {
                const conditionGroup = {
                    ...item,
                    children
                } as GenericTreeNodeFiltered<SchemaTaggedMessageLegalContents, SchemaTag>
                return [conditionGroup]
            }
        }
        return []
    }).flat(1)
    return returnValue
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

//
// unwrapSubject takes a schema node that might be a replace or remove, and returns the first tag in the tree hierarchy
// that is *not* an edit tag (i.e., the subject content being edited)
//
export const unwrapSubject = <Extra extends {}>(node: GenericTreeNode<SchemaTag>): GenericTreeNode<SchemaTag> | undefined => {
    if (treeNodeTypeguard(isSchemaEdit)(node)) {
        return unwrapSubject<Extra>(node.children[0])
    }
    return node
}

//
// unwrapSubject takes a schema node that might be a replace or remove, and returns the first tag in the tree hierarchy
// that is *not* an edit tag (i.e., the subject content being edited)
//
export const wrappedNodeTypeGuard = <SubType extends SchemaTag>(typeGuard: (value: SchemaTag) => value is SubType) => (node: GenericTreeNode<SchemaTag>): node is EditWrappedStandardNode<SubType, SchemaTag> => {
    if (treeNodeTypeguard(isSchemaEdit)(node)) {
        return node.children.reduce((previous, child) => (previous && wrappedNodeTypeGuard<SubType>(typeGuard)(child)), true)
    }
    else {
        return typeGuard(node.data)
    }
}

export const ignoreWrapped = <F extends SchemaTag, C extends SchemaTag>(node: EditWrappedStandardNode<F, C> | undefined): GenericTreeNodeFiltered<F, C> | undefined => {
    if (!node) { return undefined  }
    if (treeNodeTypeguard(isSchemaReplace)(node) || treeNodeTypeguard(isSchemaRemove)(node)) {
        const subject = unwrapSubject(node)
        if (!subject) {
            throw new Error('No subject in ignoreWrapped')
        }
        return { data: subject.data as F, children: [] }
    }
    return node as unknown as GenericTreeNodeFiltered<F, C>
}