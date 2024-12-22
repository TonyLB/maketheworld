import { RenderTreeNode } from "./baseClasses"
import { isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTree, treeNodeTypeguard } from "../../tree/baseClasses"

export const isRenderTreeNode = (node: any): node is RenderTreeNode => {
    if (typeof node === "string") {
        return true
    } else if (typeof node === "object") {
        if (node.data && isSchemaOutputTag(node.data) && Array.isArray(node.children)) {
            return node.children.every(isRenderTreeNode)
        }
    }
    return false
}

export const stripUIFields = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
    tree.map((node) => (
        (treeNodeTypeguard(isSchemaConditionStatement)(node) || treeNodeTypeguard(isSchemaConditionFallthrough)(node))
        ? {
            data: { ...node.data, selected: undefined },
            children: stripUIFields(node.children) ?? []
        }
        : {
            ...node,
            children: stripUIFields(node.children) ?? []
        }
    ))
)
