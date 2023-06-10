import { extractDependenciesFromJS } from "@tonylb/mtw-wml/dist/convert/utils"
import { ComponentRenderItem, NormalConditionStatement } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import {
    CustomBeforeBlock,
    CustomBlock,
    CustomReplaceBlock,
    isCustomBeforeBlock,
    isCustomElseBlock,
    isCustomElseIfBlock,
    isCustomFeatureLink,
    isCustomIfBlock,
    isCustomKnowledgeLink,
    isCustomLink,
    isCustomParagraph,
    isCustomParagraphContents,
    isCustomReplaceBlock,
    isCustomText
} from "../baseClasses"

export const descendantsToRender = (items: (CustomBeforeBlock | CustomReplaceBlock | CustomBlock)[]): ComponentRenderItem[] => {
    let runningConditions: NormalConditionStatement[] = []
    return items.reduce<ComponentRenderItem[]>((accumulator, item, index) => {
        if (isCustomIfBlock(item)) {
            const ifCondition = {
                if: item.source,
                dependencies: extractDependenciesFromJS(item.source)
            }
            runningConditions = [{ ...ifCondition, not: true }]
            return [
                ...accumulator,
                {
                    tag: 'Condition',
                    conditions: [ifCondition],
                    contents: descendantsToRender(item.children)
                }
            ]
        }
        else if (isCustomElseIfBlock(item)) {
            const newCondition = {
                if: item.source,
                dependencies: extractDependenciesFromJS(item.source)
            }
            runningConditions = [
                ...runningConditions,
                { ...newCondition, not: true }
            ]
            return [
                ...accumulator,
                {
                    tag: 'Condition',
                    conditions: [...(runningConditions.slice(0, -1)), newCondition],
                    contents: descendantsToRender(item.children)
                }
            ]
        }
        else if (isCustomElseBlock(item)) {
            const returnVal: ComponentRenderItem[] = [
                ...accumulator,
                {
                    tag: 'Condition',
                    conditions: [...runningConditions],
                    contents: descendantsToRender(item.children)
                }
            ]
            runningConditions = []
            return returnVal
        }
        else if (isCustomParagraph(item) || (isCustomParagraphContents(item) && (isCustomBeforeBlock(item) || isCustomReplaceBlock(item)))) {
            return item.children
                .filter((item) => (!(isCustomText(item) && !item.text)))
                .reduce<ComponentRenderItem[]>((previous, item) => {
                    if (isCustomLink(item)) {
                        const targetTag = isCustomFeatureLink(item)
                            ? 'Feature'
                            : isCustomKnowledgeLink(item)
                                ? 'Knowledge'
                                : 'Action'
                        return [
                            ...previous,
                            {
                                tag: 'Link',
                                targetTag,
                                to: item.to,
                                text: item.children
                                    .filter((child) => ('text' in child))
                                    .map(({ text }) => (text))
                                    .join('')
                            }
                        ]
                    }
                    if (isCustomBeforeBlock(item) || isCustomReplaceBlock(item)) {
                        return [
                            ...previous,
                            {
                                tag: item.type === 'before' ? 'Before' : 'Replace',
                                contents: descendantsToRender([item])
                            }
                        ]
                    }
                    if ('text' in item) {
                        const lastItem = previous.at(-1)
                        if (lastItem && lastItem.tag === 'String') {
                            return [
                                ...previous.slice(0, -1),
                                {
                                    tag: 'String',
                                    value: lastItem.value.trimEnd()
                                },
                                { tag: 'LineBreak' },
                                {
                                    tag: 'String',
                                    value: item.text
                                }
                            ]
                        }
                        return [
                            ...previous,
                            item.text.trim()
                                ? {
                                    tag: 'String',
                                    value: item.text
                                }
                                : { tag: 'Space' }
                        ]
                    }
                    return previous
                }, accumulator)
        }
        return accumulator
    }, [] as ComponentRenderItem[])
}

export default descendantsToRender
