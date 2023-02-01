import { ComponentRenderItem, NormalConditionStatement, NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { deepEqual } from "../../../../lib/objects"
import {
    CustomActionLinkElement,
    CustomFeatureLinkElement,
    CustomIfBlock,
    CustomParagraphContents,
    CustomParagraphElement,
    CustomText,
    isCustomElseBlock,
    isCustomElseIfBlock,
    isCustomIfBase,
    isCustomLineBreak
} from "../baseClasses"

const descendantsTranslate = function * (normalForm: NormalForm, renderItems: ComponentRenderItem[]): Generator<CustomParagraphContents> {
    let currentIfElement: CustomIfBlock | undefined
    const conditionElseContext: (current: CustomIfBlock | undefined) => { elseContext: string[], elseDefined: boolean } = (current) => {
        if (!current) {
            return {
                elseContext: [],
                elseDefined: false
            }
        }
        else {
            return {
                elseContext: [
                    ...current.children.filter(isCustomIfBase).map(({ source }) => (source)),
                    ...current.children.filter(isCustomElseIfBlock).map(({ source }) => (source))
                ],
                elseDefined: Boolean(current.children.find(isCustomElseBlock))
            }
        }
    }
    if (renderItems.length === 0) {
        yield {
            text: ''
        }
    }
    for (const item of renderItems) {
        if (item.tag !== 'Condition' && currentIfElement) {
            yield currentIfElement
            currentIfElement = undefined
        }
        switch(item.tag) {
            case 'Space':
                yield {
                    text: ' '
                } as CustomText
                break
            case 'Link':
                const targetTag = normalForm[item.to]?.tag || 'Action'
                yield {
                    type: targetTag === 'Feature' ? 'featureLink' : 'actionLink',
                    to: item.to,
                    children: [{
                        text: item.text || ''
                    }]
                } as CustomActionLinkElement | CustomFeatureLinkElement
                break
            case 'String':
                yield { text: item.value } as CustomText
                break
            case 'LineBreak':
                yield { type: 'lineBreak' }
                break
            case 'After':
                yield *descendantsTranslate(normalForm, item.contents)
                break
            case 'Before':
            case 'Replace':
                yield {
                    type: item.tag === 'Before' ? 'before' : 'replace',
                    children: [...descendantsTranslate(normalForm, item.contents)]
                }
                break
            case 'Condition':
                const predicateToSrc = (predicate: NormalConditionStatement): string => {
                    return `${ predicate.not ? '!' : ''}${predicate.if}`
                }
                const conditionsToSrc = (predicates: NormalConditionStatement[]): string => {
                    return predicates.length <= 1 ? `${predicateToSrc(predicates[0] || { dependencies: [], if: 'false' })}` : `(${predicates.map(predicateToSrc).join(') && (')})`
                }
                const { elseContext, elseDefined } = conditionElseContext(currentIfElement)
                //
                // TODO: Make a more complicated predicate matching, to handle as yet undefined more complicate uses of the conditional list structure
                //
                const matchesElseConditions = elseContext.length &&
                    (deepEqual(elseContext, item.conditions.slice(0, elseContext.length).map((predicate) => (predicate.if))))
                if (matchesElseConditions) {
                    const remainingConditions = item.conditions.slice(elseContext.length)
                    if (remainingConditions.length && currentIfElement && !elseDefined) {
                        currentIfElement = {
                            ...currentIfElement,
                            children: [
                                ...currentIfElement.children,
                                {
                                    type: 'elseif',
                                    source: conditionsToSrc(remainingConditions),
                                    children: [...descendantsTranslate(normalForm, item.contents)]
                                }
                            ]
                        }
                    }
                    else if (currentIfElement && !elseDefined) {
                        currentIfElement = {
                            ...currentIfElement,
                            children: [
                                ...currentIfElement.children,
                                {
                                    type: 'else',
                                    children: [...descendantsTranslate(normalForm, item.contents)]
                                }
                            ]
                        }
                    }
                    else {
                        if (currentIfElement) {
                            yield currentIfElement
                        }
                        currentIfElement = {
                            type: 'if',
                            children: [{
                                type: 'ifBase',
                                source: conditionsToSrc(item.conditions),
                                children: [...descendantsTranslate(normalForm, item.contents)]
                            }]
                        }
                        }
                }
                else {
                    if (currentIfElement) {
                        yield currentIfElement
                    }
                    currentIfElement = {
                        type: 'if',
                        children: [{
                            type: 'ifBase',
                            source: conditionsToSrc(item.conditions),
                            children: [...descendantsTranslate(normalForm, item.contents)]
                        }]
                    }
                }
                break
        }
    }
    if (currentIfElement) {
        yield currentIfElement
    }
}

export const descendantsFromRender = (normalForm: NormalForm) => (render: ComponentRenderItem[]): CustomParagraphElement[] => {
    if (render.length > 0) {
        let returnValue = [] as CustomParagraphElement[]
        let accumulator = [] as CustomParagraphContents[]
        for (const item of descendantsTranslate(normalForm, render)) {
            if (isCustomLineBreak(item)) {
                returnValue = [...returnValue, { type: 'paragraph', children: accumulator.length > 0 ? accumulator : [{ text: '' }] }]
                accumulator = [{ text: ''} as CustomText]
            }
            else {
                accumulator.push(item)
            }
        }
        return [
            ...returnValue,
            ...(accumulator.length > 0
                //
                // TODO: Make or find a join procedure that joins children where possible (i.e. combines adjacent text children)
                //
                ? [{
                    type: "paragraph" as "paragraph",
                    children: accumulator
                }]
                : [] as CustomParagraphElement[])
        ]
    }
    return [{
        type: 'paragraph',
        children: [{
            text: ''
        } as CustomText]
    }]
}

export default descendantsFromRender