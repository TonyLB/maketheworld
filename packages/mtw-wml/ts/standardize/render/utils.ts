import { RenderTreeNode } from "./baseClasses"
import { isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { excludeUndefined } from "../../lib/lists"

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

export const stripUIFields = (node: GenericTreeNode<SchemaTag> | undefined): GenericTreeNode<SchemaTag> | undefined => (
    node
        ? (treeNodeTypeguard(isSchemaConditionStatement)(node) || treeNodeTypeguard(isSchemaConditionFallthrough)(node))
            ? {
                data: { ...node.data, selected: undefined },
                children: node.children.map(stripUIFields).filter(excludeUndefined)
            }
            : {
                ...node,
                children: node.children.map(stripUIFields).filter(excludeUndefined)
            }
        : undefined
)
