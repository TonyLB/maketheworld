import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { StandardRender, RemoveClass, ReplaceClass, PlainClass } from "../../render"
import { EditWrappedStandardNode } from "../dataTypes/abstract"
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import StandardReference from "../../keys/reference"

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
