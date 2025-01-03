import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaOutputTag } from "../../baseClasses"

//
// TODO: Figure out how to not need to explicitly override types
//
export const explicitSpaces = (input: GenericTree<SchemaOutputTag>) => (
    input.reduce<GenericTree<SchemaOutputTag>>((previous, { data: item, children, ...rest }, index) => {
        if (index === 0 && item.tag === 'String' && item.value.search(/^\s+/) !== -1) {
            return [
                ...previous,
                { data: { tag: 'Space' }, children: [] } as unknown as GenericTreeNode<SchemaOutputTag>,
                { data: { tag: 'String', value: item.value.trimStart() }, children: [], ...rest } as unknown as GenericTreeNode<SchemaOutputTag>
            ]
        }
        if ((index === input.length - 1) && item.tag === 'String' && item.value.search(/\s+$/) !== -1) {
            return [
                ...previous,
                { data: { tag: 'String', value: item.value.trimEnd() }, children: [], ...rest } as unknown as GenericTreeNode<SchemaOutputTag>,
                { data: { tag: 'Space' }, children: [] } as unknown as GenericTreeNode<SchemaOutputTag>
            ]
        }
        return [
            ...previous,
            { data: item, children, ...rest } as unknown as GenericTreeNode<SchemaOutputTag>
        ]
    }, [])
)
