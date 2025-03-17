import { GenericTree } from "./genericTree";
import { isSchemaOutputTag, SchemaOutputTag, SchemaTag } from "./schema";
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "./schema/condition";
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString } from "./schema/renderTree";
import { excludeUndefined } from "./utils/lists";

export type RenderTreeNode = string | {
    data: SchemaOutputTag;
    children: RenderTree;
}

export type RenderTree = RenderTreeNode[]

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

export const isRenderTree = (node: any): node is RenderTree => {
    return Array.isArray(node) && node.every(isRenderTreeNode)
}

export const renderTreeToSchema = (tree: RenderTree): GenericTree<SchemaOutputTag> => {
    return tree.map((node) => {
        if (typeof node === "string") {
            return { data: { tag: "String", value: node }, children: [] }
        } else {
            return { data: node.data, children: renderTreeToSchema(node.children) }
        }
    })
}

export const schemaToRenderTree = (tree: GenericTree<SchemaTag>): RenderTree => {
    return tree.map<RenderTreeNode | undefined>(node => {
        if (isSchemaString(node.data)) {
            return node.data.value
        }
        else if (
            isSchemaCondition(node.data) ||
            isSchemaConditionStatement(node.data) ||
            isSchemaConditionFallthrough(node.data) ||
            isSchemaLink(node.data) ||
            isSchemaSpacer(node.data) ||
            isSchemaLineBreak(node.data)
        ) {
            return {
                data: node.data, children: schemaToRenderTree(node.children)
            }
        }
        else {
            return undefined
        }
    })
    .filter(excludeUndefined)
}
