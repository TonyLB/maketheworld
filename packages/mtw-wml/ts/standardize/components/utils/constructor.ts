import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { treeTypeGuard } from "../../../tree/filter"
import { EditInternalStandardNode, EditWrappedStandardNode } from "../dataTypes/abstract"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaReplaceMatchTag, SchemaReplacePayloadTag } from "@tonylb/mtw-base/ts/schema/edit"

export const defaultSelected = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
    tree.map((node) => {
        if (treeNodeTypeguard(isSchemaCondition)(node)) {
            const indexOfFirstSelected = node.children.findIndex(({ data }) => ((isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)) && (data.selected ?? false) ))
            if (indexOfFirstSelected !== -1) {
                return {
                    ...node,
                    children: defaultSelected(node.children.map((child, index) => (
                        treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child)
                            ? { ...child, data: { ...child.data, selected: index === indexOfFirstSelected ? true : undefined } }
                            : child
                    )))
                }
            }
            else {
                const fallThroughIndex = node.children.findIndex(treeNodeTypeguard(isSchemaConditionFallthrough))
                return {
                    ...node,
                    children: defaultSelected(node.children.map((child, index) => (
                        treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child)
                            ? { ...child, data: { ...child.data, selected: index === fallThroughIndex } }
                            : child
                    )))
                }
            }
        }
        return {
            ...node,
            children: defaultSelected(node.children)
        }
    })
)

export const outputNodeUnedited = <T extends SchemaTag, ChildType extends SchemaTag>(
    node: GenericTreeNodeFiltered<T, SchemaTag> | undefined,
    typeGuard: (value: SchemaTag) => value is ChildType,
    defaultValue: T
): EditInternalStandardNode<T, ChildType> => {
    return node
        ? { ...node, children: treeTypeGuard({ tree: defaultSelected(node.children), typeGuard }) }
        : { data: defaultValue, children: [] }
}

export const outputNodeToStandardItem = <T extends SchemaTag, ChildType extends SchemaTag>(
    node: GenericTreeNode<SchemaTag> | undefined,
    typeGuard: (value: SchemaTag) => value is T,
    childTypeGuard: (value: SchemaTag) => value is ChildType,
    defaultValue: T
): EditWrappedStandardNode<T, ChildType> | undefined => {
    if (node) {
        if (treeNodeTypeguard(isSchemaRemove)(node)) {
            return {
                ...node,
                children: node.children
                    .filter(treeNodeTypeguard(typeGuard))
                    .map((child) => (outputNodeUnedited<T, ChildType>(child, childTypeGuard, defaultValue)))
            }
        }
        if (treeNodeTypeguard(isSchemaReplace)(node)) {
            return {
                ...node,
                children: node.children
                    .filter((child): child is GenericTreeNodeFiltered<SchemaReplaceMatchTag | SchemaReplacePayloadTag, SchemaTag> => (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)))
                    .map((child) => ({
                        ...child,
                        children: child.children
                            .filter(treeNodeTypeguard(typeGuard))
                            .map((innerChild) => (outputNodeUnedited(innerChild, childTypeGuard, defaultValue)))
                    }))
            }
        }
        if (treeNodeTypeguard(typeGuard)(node)) {
            return outputNodeUnedited<T, ChildType>(node, childTypeGuard, defaultValue)
        }
    }
    return undefined
}
