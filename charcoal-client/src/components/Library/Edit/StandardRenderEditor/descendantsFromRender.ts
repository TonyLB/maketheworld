import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender, StandardRenderSimple } from "@tonylb/mtw-wml/ts/standardize/render"
import { CustomActionLinkElement, CustomBlock, CustomFeatureLinkElement, CustomKnowledgeLinkElement } from "../baseClasses"
import {
    CustomParagraphContents,
    CustomParagraphElement,
    CustomText,
    isCustomBlock,
    isCustomIfWrapper,
    isCustomLineBreak
} from "../baseClasses"
import StandardRenderString from "@tonylb/mtw-wml/ts/standardize/render/string"
import StandardRenderLineBreak from "@tonylb/mtw-wml/ts/standardize/render/lineBreak"
import StandardRenderSpace from "@tonylb/mtw-wml/ts/standardize/render/space"
import StandardRenderLink from "@tonylb/mtw-wml/ts/standardize/render/link"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import StandardAction from "@tonylb/mtw-wml/ts/standardize/components/action"

const descendantsTranslate = (render: StandardRender, options: { standard: StandardForm }): (CustomParagraphContents)[] => {
    const payload = render._payload
    if (!(payload instanceof StandardRenderSimple)) {
        return []

    }
    const returnValue = payload._elements.reduce<CustomParagraphContents[]>((previous, simpleRenderElement) => {
        if (simpleRenderElement instanceof StandardRenderString) {
            return [...previous, { text: simpleRenderElement.plainString }]
        }
        if (simpleRenderElement instanceof StandardRenderLineBreak) {
            return [...previous, { type: 'lineBreak' }]
        }
        if (simpleRenderElement instanceof StandardRenderSpace) {
            return [...previous, { text: ' ' }]
        }
        if (simpleRenderElement instanceof StandardRenderLink) {
            const linkTarget = options.standard.byId[simpleRenderElement._to]
            return [...previous, {
                type: linkTarget instanceof StandardFeature ? 'featureLink' : linkTarget instanceof StandardAction ? 'actionLink' : 'knowledgeLink',
                to: simpleRenderElement._to,
                children: [{ text: simpleRenderElement._text || '' }]
            } as CustomActionLinkElement | CustomFeatureLinkElement | CustomKnowledgeLinkElement]
        }
        throw new Error('Invalid render element')
    }, [])
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

export const descendantsFromRender = (render: StandardRender, options: { standard: StandardForm }): CustomBlock[] => {
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
