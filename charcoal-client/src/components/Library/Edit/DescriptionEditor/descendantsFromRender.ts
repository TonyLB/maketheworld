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
import { Path } from 'slate'

type DescendantsTranslateOptions = {
    normalForm: NormalForm;
    path?: Path;
    currentPathIndex?: number;
}

//
// Confirm that normalize is running in the editor, and then you can remove the path rendering
// from this translate.
//
const descendantsTranslate = function * (renderItems: ComponentRenderItem[], options: DescendantsTranslateOptions): Generator<CustomParagraphContents | CustomIfBlock | CustomElseIfBlock | CustomElseBlock> {
    const { normalForm, path = [] } = options
    let currentIfSequence: (CustomIfBlock | CustomElseIfBlock | CustomElseBlock)[] = []
    let currentIndex = options.currentPathIndex ?? 0
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
                currentIndex++
                yield {
                    text: ' '
                } as CustomText
                break
            case 'Link':
                currentIndex++
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
                currentIndex++
                yield { text: item.value } as CustomText
                break
            case 'LineBreak':
                yield { type: 'lineBreak' }
                break
            case 'After':
                const afterTranslate = [...descendantsTranslate(item.contents, { normalForm, path, currentPathIndex: currentIndex })]
                currentIndex += afterTranslate.length
                yield* afterTranslate as any
                break
            case 'Before':
            case 'Replace':
                currentIndex++
                yield {
                    type: item.tag === 'Before' ? 'before' : 'replace',
                    children: [...descendantsTranslate(item.contents, { normalForm, path: [...path, currentIndex] })].filter(isCustomParagraphContents)
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
                                children: descendantsFromRender(item.contents, { normalForm, path: [...path, currentIndex] }),
                                path: [...path, currentIndex]
                            }
                        ]
                        currentIndex++
                    }
                    else if (currentIfSequence.length && !elseDefined) {
                        currentIfSequence = [
                            ...currentIfSequence,
                            {
                                type: 'else',
                                children: descendantsFromRender(item.contents, { normalForm, path: [...path, currentIndex] })
                            }
                        ]
                        currentIndex++
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
                            children: descendantsFromRender(item.contents, { normalForm, path: [...path, currentIndex] }),
                            path: [...path, currentIndex]
                        }]
                        currentIndex++
                    }
                }
                else {
                    if (currentIfSequence) {
                        yield* (currentIfSequence.map(mapConditionIsElseValid)) as any
                    }
                    currentIfSequence = [{
                        type: 'ifBase',
                        source: conditionsToSrc(item.conditions),
                        children: descendantsFromRender(item.contents, { normalForm, path: [...path, currentIndex] }),
                        path: [...path, currentIndex]
                    }]
                    currentIndex++
                }
                break
        }
    }
    if (currentIfSequence) {
        yield* (currentIfSequence.map(mapConditionIsElseValid)) as any
    }
}

export const descendantsFromRender = (render: ComponentRenderItem[], options: DescendantsTranslateOptions): CustomBlock[] => {
    const { normalForm, path = [] } = options
    if (render.length > 0) {
        let returnValue = [] as CustomBlock[]
        let accumulator = [] as CustomParagraphContents[]
        for (const item of descendantsTranslate(render, { normalForm, path })) {
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