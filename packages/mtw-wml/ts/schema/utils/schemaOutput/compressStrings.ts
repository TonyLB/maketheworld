import { GenericTree, GenericTreeNode } from "../../../tree/baseClasses"
import { SchemaOutputTag, isSchemaSpacer, isSchemaString } from "../../baseClasses"

export function compressStrings (tags: GenericTree<SchemaOutputTag>): GenericTree<SchemaOutputTag> {
    const translateToString = (tag: GenericTreeNode<SchemaOutputTag>): GenericTreeNode<SchemaOutputTag> => {
        const { data, children } = tag
        if (isSchemaSpacer(data)) {
            return { data: { tag: 'String', value: ' ' }, children }
        }
        else {
            return tag
        }
    }
    return tags.reduce<GenericTree<SchemaOutputTag>>((previous, tag) => {
        const last = previous.length ? previous.slice(-1)[0] : undefined
        if (!last) {
            return [translateToString(tag)]
        }
        const { data: lastData, children: lastChildren } = last
        const { data, children } = translateToString(tag)
        if (isSchemaString(data) && isSchemaString(lastData)) {
            const space = `${lastData.value.trimEnd()}${data.value.trimStart()}` !== `${lastData.value}${data.value}`
            return [
                ...previous.slice(0, -1),
                {
                    data: { tag: 'String', value: space ? `${lastData.value.trimEnd()} ${data.value.trimStart()}` : `${lastData.value}${data.value}` },
                    children: [...lastChildren, ...children]
                }
            ]
        }
        return [...previous, { data, children }]
    }, [])
}
