import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRender, StandardRenderRemove, StandardRenderReplace, StandardRenderSimple, StandardRenderSimpleBase } from "../../render"
import { EditWrappedStandardNode } from "../dataTypes/abstract"
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import StandardReference from "../../keys/reference"

export const extractStandardRender = <D extends SchemaTag>(node: EditWrappedStandardNode<D, SchemaOutputTag> | undefined, typeguard: (data: SchemaTag) => data is D, errorMessage: string): StandardRender | undefined => {
    if (!node) {
        return undefined
    }
    if (treeNodeTypeguard(typeguard)(node)) {
        return new StandardRender(node.children)
    }
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        const child = node.children[0]
        if (!(child && treeNodeTypeguard(typeguard)(child))) {
            throw new Error(errorMessage)
        }
        return new StandardRender(new StandardRenderRemove(child.children))
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const match = node.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
        const payload = node.children.find(treeNodeTypeguard(isSchemaReplacePayload))
        if (match && payload) {
            const matchChild = match.children[0]
            const payloadChild = payload.children[0]
            if (matchChild && treeNodeTypeguard(typeguard)(matchChild) && payloadChild && treeNodeTypeguard(typeguard)(payloadChild)) {
                return new StandardRender(new StandardRenderReplace([node]))
            }
        }
    }
    throw new Error(errorMessage)
}

export const rebuildSchemaFromStandardRender = <D extends SchemaTag>(render: StandardRender | undefined, data: D, mappings?: StandardReference[]): EditWrappedStandardNode<D, SchemaOutputTag> | undefined => {
    if (!render) { return undefined }
    // Remap Links to 'key' format before generating schema (Links are always structural, never content-displaying references)
    const remappedRender = mappings ? render.remapReferences({ mapping: mappings, mapTo: 'key' }) : render
    const payload = remappedRender._payload
    if (payload instanceof StandardRenderRemove) {
        return { data: { tag: 'Remove' as const }, children: [{ data, children: payload.match.schema }] }
    }
    if (payload instanceof StandardRenderReplace) {
        return {
            data: { tag: 'Replace' as const },
            children: [
                { data: { tag: 'ReplaceMatch' as const }, children: [{ data, children: payload.match.schema }] },
                { data: { tag: 'ReplacePayload' as const }, children: [{ data, children: payload.payload.schema }] }
            ]
        }
    }
    if (payload.schema.length) {
        return { data, children: payload.schema }
    }
    return undefined
}
