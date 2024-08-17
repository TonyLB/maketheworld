import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId, treeNodeTypeguard } from "../../tree/baseClasses"
import {
    isSchemaCondition,
    isSchemaDescription,
    isSchemaName,
    SchemaTag,
    SchemaTaggedMessageLegalContents,
    isSchemaTaggedMessageLegalContents,
    isSchemaConditionStatement,
    isSchemaConditionFallthrough,
    isSchemaRemove,
    isSchemaReplace,
    isSchemaReplaceMatch,
    isSchemaReplacePayload
} from "../baseClasses"

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
export const unwrapSubject = <Extra extends {}>(node: GenericTreeNode<SchemaTag, Extra>): GenericTreeNode<SchemaTag, Extra> | undefined => {
    if (
        treeNodeTypeguard(isSchemaRemove)(node) ||
        treeNodeTypeguard(isSchemaReplace)(node) ||
        treeNodeTypeguard(isSchemaReplaceMatch)(node) ||
        treeNodeTypeguard(isSchemaReplacePayload)(node)
    ) {
        return unwrapSubject<Extra>(node.children[0])
    }
    return node
}
