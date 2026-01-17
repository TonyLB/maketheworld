import { treeNodeTypeguard, GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRender, RemoveClass, ReplaceClass, PlainClass } from "../../render"
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
        // Construct Remove schema structure for StandardRender constructor
        return new StandardRender([{ data: { tag: 'Remove' as const }, children: child.children }])
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const match = node.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
        const payload = node.children.find(treeNodeTypeguard(isSchemaReplacePayload))
        if (match && payload) {
            const matchChild = match.children[0]
            const payloadChild = payload.children[0]
            if (matchChild && treeNodeTypeguard(typeguard)(matchChild) && payloadChild && treeNodeTypeguard(typeguard)(payloadChild)) {
                // Pass the Replace schema structure directly
                return new StandardRender([node])
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
    
    if (payload instanceof RemoveClass) {
        const match = (payload as any).match
        return { data: { tag: 'Remove' as const }, children: [{ data, children: match?.schema ?? [] }] }
    }
    if (payload instanceof ReplaceClass) {
        const match = (payload as any).match
        const replacePayload = (payload as any).payload
        return {
            data: { tag: 'Replace' as const },
            children: [
                { data: { tag: 'ReplaceMatch' as const }, children: [{ data, children: match?.schema ?? [] }] },
                { data: { tag: 'ReplacePayload' as const }, children: [{ data, children: replacePayload?.schema ?? [] }] }
            ]
        }
    }
    if (payload instanceof PlainClass) {
        if (payload.schema.length) {
            // StandardRender.schema returns GenericTree<SchemaOutputTag> because RenderTree only maps to SchemaOutputTag
            return { data, children: payload.schema as GenericTree<SchemaOutputTag> }
        }
    }
    return undefined
}
