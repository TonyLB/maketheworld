import { StandardLiteral, StandardLiteralRemove, StandardLiteralReplace, StandardLiteralSimple } from "."
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema"
import { EditInternalStandardNode, EditWrappedStandardNode } from "../baseClasses"
import { SchemaShortNameTag } from "@tonylb/mtw-base/ts/schema/components"
import { SchemaOneCoolThingTag } from "@tonylb/mtw-base/ts/schema/character"

export const nestStandardLiteralTag = <T extends SchemaShortNameTag | SchemaOneCoolThingTag>(node: StandardLiteral, tag: T["tag"]): EditWrappedStandardNode<T, SchemaOutputTag> => {
    if (node._payload instanceof StandardLiteralSimple) {
        return { data: { tag, value: node._payload.toJSON() as string } as T, children: [] }
    }
    if (node._payload instanceof StandardLiteralRemove) {
        return { data: { tag: 'Remove' as const }, children: [nestStandardLiteralTag(new StandardLiteral(node._payload.match), tag) as EditInternalStandardNode<T, SchemaOutputTag>] }
    }
    if (node._payload instanceof StandardLiteralReplace) {
        return { data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: [nestStandardLiteralTag(new StandardLiteral(node._payload.match), tag) as EditInternalStandardNode<T, SchemaOutputTag>] },
            { data: { tag: 'ReplacePayload' as const }, children: [nestStandardLiteralTag(new StandardLiteral(node._payload.payload), tag) as EditInternalStandardNode<T, SchemaOutputTag>] }
        ]}
    }
    throw new Error('Unexpected StandardLiteral payload type in nestStandardLiteralTag')
}
