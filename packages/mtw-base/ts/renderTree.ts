import { isSchemaOutputTag, SchemaOutputTag } from "./schema";

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
