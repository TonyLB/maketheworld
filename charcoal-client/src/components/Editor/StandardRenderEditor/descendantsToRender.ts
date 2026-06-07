import {
    CustomBlock,
    CustomParagraphElement,
    isCustomBlock,
    isCustomLink,
    isCustomParagraph
} from "../baseClasses"
import { Descendant, Text } from "slate"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"

const paragraphHasSubstantiveContent = (item: CustomParagraphElement): boolean =>
    item.children.some((child) => !(Text.isText(child) && !child.text))

const isEmptyMiddleParagraph = (paragraphs: CustomParagraphElement[], index: number): boolean => {
    if (paragraphHasSubstantiveContent(paragraphs[index])) {
        return false
    }
    if (index === 0 || index === paragraphs.length - 1) {
        return false
    }
    return paragraphHasSubstantiveContent(paragraphs[index - 1]) &&
        paragraphHasSubstantiveContent(paragraphs[index + 1])
}

export const descendantsToRender = (standard: StandardForm) => (items: Descendant[]): StandardRender => {
    const paragraphs = items
        .filter((value): value is CustomBlock => isCustomBlock(value))
        .filter((value): value is CustomParagraphElement => isCustomParagraph(value))

    const returnValue = paragraphs.reduce<StandardRender>((previous, item, index) => {
        const paragraphResult = item.children
            .filter((item) => (!(Text.isText(item) && !item.text)))
            .reduce<StandardRender>((accumulator, item) => {
                if (isCustomLink(item)) {
                    const text = item.children
                        .filter((child) => ('text' in child))
                        .map(({ text }) => (text))
                        .join('')
                    const merged = accumulator.merge(new StandardRender([{ data: { tag: 'Link', to: item.to, text }, children: [] }]))
                    return merged ?? accumulator
                }
                if ('text' in item) {
                    const merged = accumulator.merge(new StandardRender([item.text]))
                    return merged ?? accumulator
                }
                return accumulator
            }, (() => {
                if ((previous.plain?.length ?? 0) === 0) {
                    return previous
                }
                const boundaryTag = isEmptyMiddleParagraph(paragraphs, index)
                    ? { data: { tag: 'DoubleBR' as const }, children: [] as [] }
                    : { data: { tag: 'br' as const }, children: [] as [] }
                const merged = previous.merge(new StandardRender([boundaryTag]))
                return merged ?? previous
            })())
        return paragraphResult
    }, new StandardRender([]))
    return returnValue
}

export default descendantsToRender
