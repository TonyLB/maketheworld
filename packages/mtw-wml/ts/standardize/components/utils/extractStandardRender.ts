import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaOutputTag, SchemaTag } from "../../../schema/baseClasses"
import { treeNodeTypeguard } from "../../../tree/baseClasses"
import { StandardRender, StandardRenderRemove, StandardRenderReplace, StandardRenderSimple } from "../../render"
import { EditWrappedStandardNode } from "../dataTypes/abstract"

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
        return new StandardRender(new StandardRenderRemove(new StandardRenderSimple(child.children)))
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const match = node.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
        const payload = node.children.find(treeNodeTypeguard(isSchemaReplacePayload))
        if (match && payload) {
            const matchChild = match.children[0]
            const payloadChild = payload.children[0]
            if (matchChild && treeNodeTypeguard(typeguard)(matchChild) && payloadChild && treeNodeTypeguard(typeguard)(payloadChild)) {
                return new StandardRender(new StandardRenderReplace(new StandardRenderSimple(matchChild.children), new StandardRenderSimple(payloadChild.children)))
            }
        }
    }
    throw new Error(errorMessage)
}

export const rebuildSchemaFromStandardRender = <D extends SchemaTag>(render: StandardRender | undefined, data: D): EditWrappedStandardNode<D, SchemaOutputTag> | undefined => (
    render
        ? render instanceof StandardRenderRemove
            ? { data: { tag: 'Remove' }, children: [{ data, children: render._payload.toJSON() }] }
            : render instanceof StandardRenderReplace
                ? { data: { tag: 'Replace' }, children: [
                    { data: { tag: 'ReplaceMatch' }, children: [{ data, children: render._match.toJSON() }] },
                    { data: { tag: 'ReplacePayload' }, children: [{ data, children: render._payload.toJSON() }] }
                ]}
                : { data, children: render.toJSON() }
        : undefined
)
