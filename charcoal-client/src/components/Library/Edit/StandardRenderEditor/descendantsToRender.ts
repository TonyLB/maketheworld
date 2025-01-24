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
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"

export const descendantsToRender = (standard: StandardForm) => (items: Descendant[]): StandardRender => {
    const returnValue = items.filter((value): value is CustomReplaceBlock | CustomBlock => ((isCustomParagraphContents(value) && isCustomReplaceBlock(value)) || isCustomBlock(value))).reduce<StandardRender>((previous, item) => {
        if (isCustomParagraph(item)) {
            return item.children
                .filter((item) => (!(isCustomText(item) && !item.text)))
                .reduce<StandardRender>((accumulator, item) => {
                    if (isCustomLink(item)) {
                        const text = item.children
                            .filter((child) => ('text' in child))
                            .map(({ text }) => (text))
                            .join('')
                        return accumulator.merge(new StandardRender([{ data: { tag: 'Link', to: item.to, text }, children: [] }]))
                    }
                    if ('text' in item) {
                        return accumulator.merge(new StandardRender([item.text]))
                    }
                    return accumulator
                }, previous.toJSON().length ? previous.merge(new StandardRender([{ data: { tag: 'br' }, children: [] }])) : previous)
        }
        return previous
    }, new StandardRender([]))
    return returnValue
}

export default descendantsToRender
