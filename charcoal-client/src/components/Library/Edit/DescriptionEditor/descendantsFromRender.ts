import {
    CustomActionLinkElement,
    CustomBlock,
    CustomFeatureLinkElement,
    CustomKnowledgeLinkElement,
    CustomParagraphContents,
    CustomParagraphElement,
    CustomText,
    isCustomBlock,
    isCustomIfWrapper,
    isCustomLineBreak,
    isCustomParagraphContents
} from "../baseClasses"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaOutputTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses"

const descendantsTranslate = (tree: GenericTree<SchemaOutputTag, TreeId>, options: { standard: StandardForm }): (CustomParagraphContents)[] => {
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
                    type: options.standard.byId[item.to]?.tag === 'Feature' ? 'featureLink' : options.standard.byId[item.to]?.tag === 'Action' ? 'actionLink' : 'knowledgeLink',
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
            case 'Replace':
                returnValue.push({
                    type: 'replace',
                    children: [...descendantsTranslate(children, options)].filter(isCustomParagraphContents)
                })
                break
            case 'If':
                returnValue.push({
                    type: 'ifWrapper',
                    treeId: id,
                    subTree: { data: item, children },
                    position: 0,
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

export const descendantsFromRender = (render: GenericTree<SchemaOutputTag, TreeId>, options: { standard: StandardForm }): CustomBlock[] => {
    let returnValue = [] as CustomBlock[]
    let accumulator = [] as CustomParagraphContents[]
    const translated = descendantsTranslate(render, options)
    descendantsCompact(translated).forEach((item, index) => {
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
                    { ...item, type: 'ifWrapper', position: index, children: [{ text: '' }] }
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
    if (returnValue.length + accumulator.length === 0) {
        return [{
            type: 'paragraph',
            children: [{
                text: ''
            } as CustomText]
        }]
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

export default descendantsFromRender