import {
    CustomBlock,
    CustomReplaceBlock,
    isCustomBlock,
    isCustomLink,
    isCustomParagraph,
    isCustomParagraphContents,
    isCustomReplaceBlock,
    isCustomText
} from "../baseClasses"
import { Descendant } from "slate"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender, PlainClass } from "@tonylb/mtw-wml/ts/standardize/render"

export const descendantsToRender = (standard: StandardForm) => (items: Descendant[]): StandardRender => {
    const returnValue = items.filter((value): value is CustomReplaceBlock | CustomBlock => ((isCustomParagraphContents(value) && isCustomReplaceBlock(value)) || isCustomBlock(value))).reduce<StandardRender>((previous, item) => {
        if (isCustomParagraph(item)) {
            const paragraphResult = item.children
                .filter((item) => (!(isCustomText(item) && !item.text)))
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
                    const merged = previous.merge(new StandardRender([{ data: { tag: 'br' }, children: [] }]))
                    return (previous.plain?.length ?? 0) > 0 ? (merged ?? previous) : previous
                })())
            return paragraphResult
        }
        return previous
    }, new StandardRender([]))
    return returnValue
}

export default descendantsToRender
