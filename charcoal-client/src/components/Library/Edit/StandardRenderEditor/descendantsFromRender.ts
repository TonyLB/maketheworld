import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender, PlainClass as StandardRenderSimple, PlainClass } from "@tonylb/mtw-wml/ts/standardize/render"
import { CustomBlock, CustomFeatureLinkElement, CustomKnowledgeLinkElement } from "../baseClasses"
import {
    CustomParagraphContents,
    CustomParagraphElement,
    CustomText,
    isCustomBlock,
    isCustomIfWrapper,
    isCustomLineBreak
} from "../baseClasses"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer } from "@tonylb/mtw-base/ts/schema/renderTree"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"

const descendantsTranslate = (render: StandardRender, options: { standard: StandardForm }): (CustomParagraphContents)[] => {
    const payload = render._payload
    if (!(payload instanceof PlainClass)) {
        return []

    }
    const plain = payload.plain
    if (!plain) {
        return []
    }
    const renderTree: RenderTree = plain.toJSON()
    const returnValue = renderTree.reduce<CustomParagraphContents[]>((previous, simpleRenderElement) => {
        if (typeof simpleRenderElement === 'string') {
            return [...previous, { text: simpleRenderElement }]
        }
        if (isSchemaLineBreak(simpleRenderElement.data)) {
            return [...previous, { type: 'lineBreak' }]
        }
        if (isSchemaSpacer(simpleRenderElement.data)) {
            return [...previous, { text: ' ' }]
        }
        if (isSchemaLink(simpleRenderElement.data)) {
            const linkTarget = options.standard.byId[simpleRenderElement.data.to]
            return [...previous, {
                type: linkTarget instanceof StandardFeature ? 'featureLink' : 'knowledgeLink',
                to: simpleRenderElement.data.to,
                children: [{ text: simpleRenderElement.children.filter((child) => typeof child === 'string').join('') }]
            } as CustomFeatureLinkElement | CustomKnowledgeLinkElement]
        }
        throw new Error('Invalid render element')
    }, [])
    return returnValue
}

export const descendantsCompact = (items: (CustomParagraphContents)[]): (CustomParagraphContents)[] =>  {
    const { previousText, returnValue } = items.reduce<{ previousText?: string, returnValue: (CustomParagraphContents)[] }>((previous, item) =>  {
        if ('text' in item) {
            // Combine text elements
            const newText = `${(previous.previousText || '')}${item.text}`
            const normalizedText = newText.replace(/\s+/g, ' ')
            return {
                ...previous,
                previousText: normalizedText
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
    
    // Normalize multiple spaces to single spaces in the final text
    if (previousText) {
        const normalizedText = previousText.replace(/\s+/g, ' ')
        return [...returnValue, { text: normalizedText }]
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
