import {
    CustomBlock,
    CustomReplaceBlock,
    isCustomIfWrapper,
    isCustomLink,
    isCustomNewIfWrapper,
    isCustomParagraph,
    isCustomParagraphContents,
    isCustomReplaceBlock,
    isCustomText
} from "../baseClasses"
import { GenericTree } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaOutputTag, SchemaTag, isSchemaCondition, isSchemaOutputTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"

export const descendantsToRender = (schema: GenericTree<SchemaTag>) => (items: (CustomReplaceBlock | CustomBlock)[]): GenericTree<SchemaOutputTag> => {
    const returnValue = items.reduce<GenericTree<SchemaOutputTag>>((tree, item) => {
        if (isCustomNewIfWrapper(item)) {
            return [
                ...tree,
                {
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: '' },
                        children: []
                    }]
                }
            ]
        }
        if (isCustomIfWrapper(item)) {
            const node = item.subTree
            if (typeof node === 'undefined') {
                return tree
            }
            const { data } = node
            if (!isSchemaCondition(data)) {
                return tree
            }
            return [
                ...tree,
                { data, children: treeTypeGuard({ tree: node.children, typeGuard: isSchemaOutputTag }) }
            ]
        }
        if (isCustomParagraph(item) || (isCustomParagraphContents(item) && isCustomReplaceBlock(item))) {
            return item.children
                .filter((item) => (!(isCustomText(item) && !item.text)))
                .reduce<GenericTree<SchemaOutputTag>>((previous, item) => {
                    if (isCustomLink(item)) {
                        const text = item.children
                            .filter((child) => ('text' in child))
                            .map(({ text }) => (text))
                            .join('')
                        return [
                            ...previous,
                            {
                                data: {
                                    tag: 'Link', 
                                    to: item.to,
                                    text
                                },
                                children: [{ data: { tag: 'String', value: text }, children: [] }]
                            }
                        ]
                    }
                    if (isCustomReplaceBlock(item)) {
                        return [
                            ...previous,
                            {
                                data: { tag: 'Replace' },
                                children: descendantsToRender(schema)([item])
                            }
                        ]
                    }
                    if ('text' in item) {
                        const lastItem = previous.at(-1)?.data
                        if (lastItem && lastItem.tag === 'String') {
                            return [
                                ...previous.slice(0, -1),
                                { data: { tag: 'String', value: lastItem.value.trimEnd() }, children: [] },
                                { data: { tag: 'br' }, children: [] },
                                { data: { tag: 'String', value: item.text }, children: [] }
                            ]
                        }
                        return [
                            ...previous,
                            item.text.trim()
                                ? { data: { tag: 'String', value: item.text }, children: [] }
                                : { data: { tag: 'Space' }, children: [] }
                        ]
                    }
                    return previous
                }, tree)
        }
        return tree
    }, [])
    return returnValue
}

export default descendantsToRender
