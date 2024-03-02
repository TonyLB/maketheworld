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
    isCustomIfWrapper,
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
    tree.forEach(({ data: item, children, id }) => {
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
                    treeId: id,
                    children: [{ text: "" }]
                })
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
                if (isCustomIfWrapper(item)) {
                    if (accumulator.length) {
                        returnValue = [
                            ...returnValue,
                            { type: 'paragraph', children: accumulator }
                        ]
                        accumulator = []
                    }
                    returnValue = [
                        ...returnValue,
                        { type: 'ifWrapper', treeId: item.treeId, children: [{ text: '' }] }
                    ]
                }
                else {
                    return returnValue
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