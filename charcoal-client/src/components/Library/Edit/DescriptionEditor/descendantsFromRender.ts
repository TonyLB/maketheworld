import { NormalConditionStatement, NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { deepEqual } from "../../../../lib/objects"
import {
    CustomActionLinkElement,
    CustomBlock,
    // CustomElseBlock,
    // CustomElseIfBlock,
    CustomFeatureLinkElement,
    // CustomIfBlock,
    CustomKnowledgeLinkElement,
    CustomParagraphContents,
    CustomParagraphElement,
    CustomText,
    isCustomBlock,
    // isCustomElseBlock,
    // isCustomElseIfBlock,
    // isCustomIfBlock,
    isCustomLineBreak,
    isCustomParagraphContents
} from "../baseClasses"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaOutputTag, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"

const descendantsTranslate = (tree: GenericTree<SchemaOutputTag, TreeId>, options: { normal: NormalForm }): (CustomParagraphContents)[] => {
    let returnValue: CustomParagraphContents[] = []
    tree.forEach(({ data: item, children }) => {
        switch(item.tag) {
            case 'Space':
                returnValue.push({
                    text: ' '
                } as CustomText)
                break
            case 'Link':
                returnValue.push({
                    type: options.normal[item.to]?.tag === 'Feature' ? 'featureLink' : options.normal[item.to]?.tag === 'Action' ? 'actionLink' : 'knowledgeLink',
                    to: item.to,
                    children: [{
                        text: item.text || ''
                    }]
                } as CustomActionLinkElement | CustomFeatureLinkElement | CustomKnowledgeLinkElement)
                break
            case 'String':
                returnValue.push({ text: item.value } as CustomText)
                break
            case 'br':
                returnValue.push({ type: 'lineBreak' })
                break
            case 'After':
                break
            case 'Before':
            case 'Replace':
                returnValue.push({
                    type: item.tag === 'Before' ? 'before' : 'replace',
                    children: [...descendantsTranslate(children, options)].filter(isCustomParagraphContents)
                })
                break
            case 'If':
                returnValue.push({
                    type: 'ifWrapper',
                    tree: treeTypeGuard({ tree: children, typeGuard: (data): data is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)) }),
                    children: []
                })
                // const predicateToSrc = (predicate: NormalConditionStatement): string => {
                //     return `${ predicate.not ? '!' : ''}${predicate.if}`
                // }
                // const conditionsToSrc = (predicates: NormalConditionStatement[]): string => {
                //     return predicates.length <= 1 ? `${predicateToSrc(predicates[0] || { dependencies: [], if: 'false' })}` : `(${predicates.map(predicateToSrc).join(') && (')})`
                // }
                // const { elseContext, elseDefined } = conditionElseContext(currentIfSequence)
                // //
                // // TODO: Make a more complicated predicate matching, to handle as yet undefined more complicate uses of the conditional list structure
                // //
                // const matchesElseConditions = elseContext.length &&
                //     (deepEqual(elseContext, item.conditions.slice(0, elseContext.length).map((predicate) => (predicate.if))))
                // if (matchesElseConditions) {
                //     const remainingConditions = item.conditions.slice(elseContext.length)
                //     const translatedChildren = descendantsFromRender(children, options)
                //     if (remainingConditions.length && currentIfSequence.length && !elseDefined) {
                //         currentIfSequence = [
                //             ...currentIfSequence,
                //             {
                //                 type: 'elseif',
                //                 source: conditionsToSrc(remainingConditions),
                //                 children: translatedChildren
                //             }
                //         ]
                //     }
                //     else if (currentIfSequence.length && !elseDefined) {
                //         currentIfSequence = [
                //             ...currentIfSequence,
                //             {
                //                 type: 'else',
                //                 children: translatedChildren
                //             }
                //         ]
                //     }
                //     else {
                //         if (currentIfSequence.length) {
                //             //
                //             // TODO: Rewrite descendantsTranslate so that we can return blocks, and handle those
                //             // blocks in descendantsFromRender
                //             //
                //             returnValue = [...returnValue, ...currentIfSequence.map(mapConditionIsElseValid)]
                //         }
                //         currentIfSequence = [{
                //             type: 'ifBase',
                //             source: conditionsToSrc(item.conditions),
                //             children: translatedChildren
                //         }]
                //     }
                // }
                // else {
                //     if (currentIfSequence) {
                //         returnValue = [...returnValue, ...currentIfSequence.map(mapConditionIsElseValid)]
                //     }
                //     currentIfSequence = [{
                //         type: 'ifBase',
                //         source: conditionsToSrc(item.conditions),
                //         children: descendantsFromRender(children, options),
                //     }]
                // }
                break
        }
    })
    return returnValue
}

const descendantsCompact = (items: (CustomParagraphContents)[]): (CustomParagraphContents)[] =>  {
    const { previousText, returnValue } = items.reduce<{ previousText?: string, returnValue: (CustomParagraphContents)[] }>((previous, item) =>  {
        if ('text' in item) {
            return {
                ...previous,
                previousText: `${(previous.previousText || '')}${item.text}`
            }
        }
        else {
            if (previous.previousText) {
                return {
                    returnValue: [
                        ...previous.returnValue,
                        { text: previous.previousText },
                        item
                    ]
                }
            }
            else {
                return { returnValue: [ ...previous.returnValue, item ] }
            }
        }
    }, { returnValue: [] })
    if (previousText) {
        return [...returnValue, { text: previousText }]
    }
    else {
        return returnValue
    }
}

export const descendantsFromRender = (render: GenericTree<SchemaOutputTag, TreeId>, options: { normal: NormalForm }): CustomBlock[] => {
    if (render.length > 0) {
        let returnValue = [] as CustomBlock[]
        let accumulator = [] as CustomParagraphContents[]
        const translated = descendantsTranslate(render, options)
        descendantsCompact(translated).forEach((item) => {
            if (isCustomBlock(item)) {
                // if (isCustomIfBlock(item) || isCustomElseIfBlock(item) || isCustomElseBlock(item)) {
                //     if (accumulator.length) {
                //         returnValue = [...returnValue, { type: 'paragraph', children: accumulator }]
                //     }
                //     returnValue = [...returnValue, item]
                //     accumulator = []
                // }
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
        })
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