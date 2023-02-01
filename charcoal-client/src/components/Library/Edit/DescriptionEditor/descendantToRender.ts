import { extractDependenciesFromJS } from "@tonylb/mtw-wml/dist/convert/utils"
import { ComponentRenderItem, NormalConditionStatement } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import {
    CustomBeforeBlock,
    CustomElseBlock,
    CustomElseIfBlock,
    CustomIfBase,
    CustomParagraphElement,
    CustomReplaceBlock,
    isCustomBeforeBlock,
    isCustomElseBlock,
    isCustomElseIfBlock,
    isCustomFeatureLink,
    isCustomIfBase,
    isCustomIfBlock,
    isCustomLink,
    isCustomReplaceBlock,
    isCustomText
} from "../baseClasses"

export const descendantsToRender = (items: (CustomParagraphElement | CustomBeforeBlock | CustomReplaceBlock | CustomIfBase | CustomElseIfBlock | CustomElseBlock)[]): ComponentRenderItem[] => (
    items.reduce<ComponentRenderItem[]>((accumulator, { children = [] }, index) => {
        return children
            .filter((item) => (!(isCustomText(item) && !item.text)))
            .reduce((previous, item) => {
                if (isCustomIfBlock(item)) {
                    const { elseIfs, ifBase, elseContents, runningConditions } = item.children.reduce<{ runningConditions: NormalConditionStatement[]; ifBase?: ComponentRenderItem | undefined; elseIfs: ComponentRenderItem[]; elseContents: ComponentRenderItem[] }>((previous, child) => {
                        if (isCustomIfBase(child)) {
                            const ifCondition = {
                                if: child.source,
                                dependencies: extractDependenciesFromJS(child.source)
                            }
                            return {
                                ...previous,
                                ifBase: {
                                    tag: 'Condition',
                                    conditions: [ifCondition],
                                    contents: descendantsToRender([child])
                                },
                                runningConditions: [{ ...ifCondition, not: true }]
                            }
                        }
                        else if (isCustomElseIfBlock(child)) {
                            const newCondition = {
                                if: child.source,
                                dependencies: extractDependenciesFromJS(child.source)
                            }
                            return {
                                ...previous,
                                elseIfs: [
                                    ...previous.elseIfs,
                                    {
                                        tag: 'Condition',
                                        conditions: [...previous.runningConditions, newCondition],
                                        contents: descendantsToRender([child])
                                    }
                                ],
                                runningConditions: [
                                    ...previous.runningConditions,
                                    { ...newCondition, not: true }
                                ]
                            }
                        }
                        else if (isCustomElseBlock(child)) {
                            return {
                                ...previous,
                                elseContents: descendantsToRender([child])
                            }
                        }
                        return previous
                    }, { elseIfs: [], elseContents: [], runningConditions: [] })
                    const elseItem: ComponentRenderItem | undefined = elseContents.length ? {
                        tag: 'Condition',
                        conditions: runningConditions,
                        contents: elseContents
                    } : undefined
                    if (ifBase) {
                        return [
                            ...previous,
                            ifBase,
                            ...elseIfs,
                            ...(elseItem ? [elseItem] : [])
                        ]    
                    }
                    else {
                        return previous
                    }
                }
                if (isCustomLink(item)) {
                    return [
                        ...previous,
                        {
                            tag: 'Link',
                            targetTag: isCustomFeatureLink(item) ? 'Feature' : 'Action',
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
                    return [
                        ...previous,
                        {
                            tag: 'String',
                            value: item.text
                        }
                    ]
                }
                return previous
            }, (index > 0) ? [...accumulator, { tag: 'LineBreak' }] : accumulator) as ComponentRenderItem[]
    }, [] as ComponentRenderItem[])
)

export default descendantsToRender
