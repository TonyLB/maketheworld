import { ComponentRenderItem, NormalConditionStatement, NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { deepEqual } from "../../../../lib/objects"
import {
    CustomActionLinkElement,
    CustomBlock,
    CustomElseBlock,
    CustomElseIfBlock,
    CustomFeatureLinkElement,
    CustomIfBlock,
    CustomParagraphContents,
    CustomParagraphElement,
    CustomText,
    isCustomBlock,
    isCustomElseBlock,
    isCustomElseIfBlock,
    isCustomIfBlock,
    isCustomLineBreak,
    isCustomParagraphContents
} from "../baseClasses"

type DescendantsTranslateOptions = {
    normalForm: NormalForm;
}

const descendantsTranslate = function * (renderItems: ComponentRenderItem[], options: DescendantsTranslateOptions): Generator<CustomParagraphContents | CustomIfBlock | CustomElseIfBlock | CustomElseBlock> {
    const { normalForm } = options
    let currentIfSequence: (CustomIfBlock | CustomElseIfBlock | CustomElseBlock)[] = []
    const conditionElseContext: (current: (CustomIfBlock | CustomElseIfBlock | CustomElseBlock)[]) => { elseContext: string[], elseDefined: boolean } = (current) => {
        if (!current) {
            return {
                elseContext: [],
                elseDefined: false
            }
        }
        else {
            return {
                elseContext: [
                    ...current.filter(isCustomIfBlock).map(({ source }) => (source)),
                    ...current.filter(isCustomElseIfBlock).map(({ source }) => (source))
                ],
                elseDefined: Boolean(current.find(isCustomElseBlock))
            }
        }
    }
    const mapConditionIsElseValid = (item: CustomIfBlock | CustomElseIfBlock | CustomElseBlock, index: number, list: (CustomIfBlock | CustomElseIfBlock | CustomElseBlock)[]): (CustomIfBlock | CustomElseIfBlock | CustomElseBlock) => {
        if (index < list.length - 1 || isCustomElseBlock(item)) {
            return item
        }
        return {
            ...item,
            isElseValid: true
        }
    }
    if (renderItems.length === 0) {
        yield {
            text: ''
        }
    }
    for (const item of renderItems) {
        if (item.tag !== 'Condition' && currentIfSequence.length) {
            yield* (currentIfSequence.map(mapConditionIsElseValid)) as any
            currentIfSequence = []
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
                const afterTranslate = [...descendantsTranslate(item.contents, { normalForm })]
                yield* afterTranslate as any
                break
            case 'Before':
            case 'Replace':
                yield {
                    type: item.tag === 'Before' ? 'before' : 'replace',
                    children: [...descendantsTranslate(item.contents, { normalForm })].filter(isCustomParagraphContents)
                }
                break
            case 'Condition':
                const predicateToSrc = (predicate: NormalConditionStatement): string => {
                    return `${ predicate.not ? '!' : ''}${predicate.if}`
                }
                const conditionsToSrc = (predicates: NormalConditionStatement[]): string => {
                    return predicates.length <= 1 ? `${predicateToSrc(predicates[0] || { dependencies: [], if: 'false' })}` : `(${predicates.map(predicateToSrc).join(') && (')})`
                }
                const { elseContext, elseDefined } = conditionElseContext(currentIfSequence)
                //
                // TODO: Make a more complicated predicate matching, to handle as yet undefined more complicate uses of the conditional list structure
                //
                const matchesElseConditions = elseContext.length &&
                    (deepEqual(elseContext, item.conditions.slice(0, elseContext.length).map((predicate) => (predicate.if))))
                if (matchesElseConditions) {
                    const remainingConditions = item.conditions.slice(elseContext.length)
                    if (remainingConditions.length && currentIfSequence.length && !elseDefined) {
                        currentIfSequence = [
                            ...currentIfSequence,
                            {
                                type: 'elseif',
                                source: conditionsToSrc(remainingConditions),
                                children: descendantsFromRender(item.contents, { normalForm }),
                            }
                        ]
                    }
                    else if (currentIfSequence.length && !elseDefined) {
                        currentIfSequence = [
                            ...currentIfSequence,
                            {
                                type: 'else',
                                children: descendantsFromRender(item.contents, { normalForm })
                            }
                        ]
                    }
                    else {
                        if (currentIfSequence.length) {
                            //
                            // TODO: Rewrite descendantsTranslate so that we can return blocks, and handle those
                            // blocks in descendantsFromRender
                            //
                            yield* (currentIfSequence.map(mapConditionIsElseValid)) as any
                        }
                        currentIfSequence = [{
                            type: 'ifBase',
                            source: conditionsToSrc(item.conditions),
                            children: descendantsFromRender(item.contents, { normalForm }),
                        }]
                    }
                }
                else {
                    if (currentIfSequence) {
                        yield* (currentIfSequence.map(mapConditionIsElseValid)) as any
                    }
                    currentIfSequence = [{
                        type: 'ifBase',
                        source: conditionsToSrc(item.conditions),
                        children: descendantsFromRender(item.contents, { normalForm }),
                    }]
                }
                break
        }
    }
    if (currentIfSequence) {
        yield* (currentIfSequence.map(mapConditionIsElseValid)) as any
    }
}

export const descendantsFromRender = (render: ComponentRenderItem[], options: DescendantsTranslateOptions): CustomBlock[] => {
    const { normalForm } = options
    if (render.length > 0) {
        let returnValue = [] as CustomBlock[]
        let accumulator = [] as CustomParagraphContents[]
        for (const item of descendantsTranslate(render, { normalForm })) {
            if (isCustomBlock(item)) {
                if (isCustomIfBlock(item) || isCustomElseIfBlock(item) || isCustomElseBlock(item)) {
                    if (accumulator.length) {
                        returnValue = [...returnValue, { type: 'paragraph', children: accumulator }]
                    }
                    returnValue = [...returnValue, item]
                    accumulator = []
                }
            }
            else {
                if (isCustomLineBreak(item)) {
                    returnValue = [...returnValue, { type: 'paragraph', children: accumulator.length > 0 ? accumulator : [{ text: '' }] }]
                    accumulator = []
                }
                else {
                    accumulator.push(item)
                }
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