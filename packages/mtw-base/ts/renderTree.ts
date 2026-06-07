import { GenericTree } from "./genericTree";
import { isSchemaOutputTag, SchemaOutputTag, SchemaTag } from "./schema";

import { isSchemaRemove, isSchemaReplace } from "./schema/edit";
import { isSchemaDoubleBR, isSchemaDoubleSpace, isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString } from "./schema/renderTree";
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

export const isSimpleRenderTreeNode = (node: any): node is RenderTreeNode => {
    return isRenderTreeNode(node) && !(typeof node === "object" && (isSchemaRemove(node.data) || isSchemaReplace(node.data)))
}

export const isSimpleRenderTree = (node: any): node is RenderTree => {
    return Array.isArray(node) && node.every(isSimpleRenderTreeNode)
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

export const schemaToRenderTree = (tree: GenericTree<SchemaTag> | RenderTree): RenderTree => {
    return tree.map<RenderTreeNode | undefined>(node => {
        if (typeof node === "string") {
            return node
        }
        if (isSchemaString(node.data)) {
            return node.data.value
        }
        else if (
            isSchemaLink(node.data) ||
            isSchemaSpacer(node.data) ||
            isSchemaLineBreak(node.data) ||
            isSchemaDoubleSpace(node.data) ||
            isSchemaDoubleBR(node.data)
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

export const renderTreeToString = (tree: RenderTree): string => {
    return tree.map((node) => {
        if (typeof node === "string") {
            return node
        }
        if (isSchemaLink(node.data)) {
            return renderTreeToSchema(node.children)
        }
        if (isSchemaSpacer(node.data)) {
            return " "
        }
        if (isSchemaDoubleSpace(node.data)) {
            return "  "
        }
        if (isSchemaLineBreak(node.data)) {
            return "\n"
        }
        if (isSchemaDoubleBR(node.data)) {
            return "\n\n"
        }
        return ''
    }).join("")
}
