import { GenericTree, GenericTreeNode } from "../../../sequence/tree/baseClasses"
import { SchemaOutputTag } from "../../baseClasses"

//
// TODO: Figure out how to not need to explicitly override types
//
export const explicitSpaces = <Extra extends {} = {}>(input: GenericTree<SchemaOutputTag, Extra>) => (
    input.reduce<GenericTree<SchemaOutputTag, Partial<Extra>>>((previous, { data: item, children, ...rest }, index) => {
        if (index === 0 && item.tag === 'String' && item.value.search(/^\s+/) !== -1) {
            return [
                ...previous,
                { data: { tag: 'Space' }, children: [] } as unknown as GenericTreeNode<SchemaOutputTag, Partial<Extra>>,
                { data: { tag: 'String', value: item.value.trimStart() }, children: [], ...rest } as unknown as GenericTreeNode<SchemaOutputTag, Partial<Extra>>
            ]
        }
        if ((index === input.length - 1) && item.tag === 'String' && item.value.search(/\s+$/) !== -1) {
            return [
                ...previous,
                { data: { tag: 'String', value: item.value.trimEnd() }, children: [], ...rest } as unknown as GenericTreeNode<SchemaOutputTag, Partial<Extra>>,
                { data: { tag: 'Space' }, children: [] } as unknown as GenericTreeNode<SchemaOutputTag, Partial<Extra>>
            ]
        }
        return [
            ...previous,
            { data: item, children, ...rest } as unknown as GenericTreeNode<SchemaOutputTag, Partial<Extra>>
        ]
    }, [])
)
