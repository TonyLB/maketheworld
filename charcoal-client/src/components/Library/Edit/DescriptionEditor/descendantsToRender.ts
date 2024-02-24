import { NormalConditionStatement } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import {
    CustomBeforeBlock,
    CustomBlock,
    CustomReplaceBlock,
    isCustomBeforeBlock,
    isCustomIfWrapper,
    isCustomLink,
    isCustomParagraph,
    isCustomParagraphContents,
    isCustomReplaceBlock,
    isCustomText
} from "../baseClasses"
import { GenericTree } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaOutputTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { stripIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree"

//
// TODO: Refactor descendantsToRender to return GenericTree<SchemaTag, { id: string }>
//
export const descendantsToRender = (items: (CustomBeforeBlock | CustomReplaceBlock | CustomBlock)[]): GenericTree<SchemaOutputTag> => {
    let runningConditions: NormalConditionStatement[] = []
    const returnValue = items.reduce<GenericTree<SchemaOutputTag>>((tree, item, index) => {
        if (isCustomParagraph(item) || (isCustomParagraphContents(item) && (isCustomBeforeBlock(item) || isCustomReplaceBlock(item)))) {
            return item.children
                .filter((item) => (!(isCustomText(item) && !item.text)))
                .reduce<GenericTree<SchemaOutputTag>>((previous, item) => {
                    if (isCustomIfWrapper(item)) {
                        return [
                            ...previous,
                            {
                                data: { tag: 'If' as const },
                                children: stripIDFromTree(item.tree)
                            }
                        ]
                    }
                    if (isCustomLink(item)) {
                        return [
                            ...previous,
                            {
                                data: {
                                    tag: 'Link', 
                                    to: item.to,
                                    text: item.children
                                    .filter((child) => ('text' in child))
                                    .map(({ text }) => (text))
                                    .join('')
                                },
                                children: []
                            }
                        ]
                    }
                    if (isCustomBeforeBlock(item) || isCustomReplaceBlock(item)) {
                        return [
                            ...previous,
                            {
                                data: { tag: item.type === 'before' ? 'Before' : 'Replace' },
                                children: descendantsToRender([item])
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
