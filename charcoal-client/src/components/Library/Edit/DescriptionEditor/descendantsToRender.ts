import { NormalConditionStatement } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import {
    CustomBeforeBlock,
    CustomBlock,
    CustomReplaceBlock,
    isCustomBeforeBlock,
    isCustomElseBlock,
    isCustomElseIfBlock,
    isCustomIfBlock,
    isCustomLink,
    isCustomParagraph,
    isCustomParagraphContents,
    isCustomReplaceBlock,
    isCustomText
} from "../baseClasses"
import { GenericTree } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaOutputTag } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"

//
// TODO: Refactor descendantsToRender to return GenericTree<SchemaOutputTag, { id: string }>
//
export const descendantsToRender = (items: (CustomBeforeBlock | CustomReplaceBlock | CustomBlock)[]): GenericTree<SchemaOutputTag> => {
    let runningConditions: NormalConditionStatement[] = []
    const returnValue = items.reduce<GenericTree<SchemaOutputTag>>((tree, item, index) => {
        if (isCustomIfBlock(item)) {
            const ifCondition = { if: item.source }
            runningConditions = [{ ...ifCondition, not: true }]
            return [
                ...tree,
                {
                    data: { tag: 'If' as const, conditions: [ifCondition] },
                    children: descendantsToRender(item.children)
                }
            ]
        }
        else if (isCustomElseIfBlock(item)) {
            const newCondition = { if: item.source }
            runningConditions = [
                ...runningConditions,
                { ...newCondition, not: true }
            ]
            return [
                ...tree,
                {
                    data: { tag: 'If' as const, conditions: [...(runningConditions.slice(0, -1)), newCondition] },
                    children: descendantsToRender(item.children)
                }
            ]
        }
        else if (isCustomElseBlock(item)) {
            const returnVal = [
                ...tree,
                {
                    data: { tag: 'If' as const, conditions: [...runningConditions] },
                    children: descendantsToRender(item.children)
                }
            ]
            runningConditions = []
            return returnVal
        }
        else if (isCustomParagraph(item) || (isCustomParagraphContents(item) && (isCustomBeforeBlock(item) || isCustomReplaceBlock(item)))) {
            return item.children
                .filter((item) => (!(isCustomText(item) && !item.text)))
                .reduce<GenericTree<SchemaOutputTag>>((previous, item) => {
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
