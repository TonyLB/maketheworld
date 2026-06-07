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

const doubleSpaceTag = { data: { tag: 'DoubleSpace' as const }, children: [] as [] }

type RenderSeed = string | typeof doubleSpaceTag

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

const interiorDoubleSpacePattern = /(?<=\S)\s{2}(?=\S)/g

const textToRenderSeeds = (
    text: string,
    boundary: 'none' | 'beforeLink' | 'afterLink'
): RenderSeed[] => {
    const trailingBeforeLink = boundary === 'beforeLink' && /(?<=\S)\s{2}$/.test(text)
    const leadingAfterLink = boundary === 'afterLink' && /^\s{2}(?=\S)/.test(text)

    let workingText = text
    const prefixSeeds: RenderSeed[] = []
    const suffixSeeds: RenderSeed[] = []

    if (leadingAfterLink) {
        workingText = workingText.replace(/^\s{2}/, '')
        prefixSeeds.push(doubleSpaceTag)
    }
    if (trailingBeforeLink) {
        workingText = workingText.replace(/(?<=\S)\s{2}$/, '')
        suffixSeeds.push(doubleSpaceTag)
    }

    if (workingText.length === 0) {
        return [...prefixSeeds, ...suffixSeeds]
    }

    const interiorSeeds: RenderSeed[] = []
    let lastIndex = 0
    for (const match of workingText.matchAll(interiorDoubleSpacePattern)) {
        if (typeof match.index !== 'number') {
            continue
        }
        if (match.index > lastIndex) {
            interiorSeeds.push(workingText.slice(lastIndex, match.index))
        }
        interiorSeeds.push(doubleSpaceTag)
        lastIndex = match.index + match[0].length
    }
    if (lastIndex < workingText.length) {
        interiorSeeds.push(workingText.slice(lastIndex))
    }

    return [...prefixSeeds, ...(interiorSeeds.length > 0 ? interiorSeeds : [workingText]), ...suffixSeeds]
}

const mergeRenderSeeds = (accumulator: StandardRender, seeds: RenderSeed[]): StandardRender =>
    seeds.reduce((acc, seed) => {
        const chunk = typeof seed === 'string'
            ? new StandardRender([seed])
            : new StandardRender([seed])
        return acc.merge(chunk) ?? acc
    }, accumulator)

export const descendantsToRender = (standard: StandardForm) => (items: Descendant[]): StandardRender => {
    const paragraphs = items
        .filter((value): value is CustomBlock => isCustomBlock(value))
        .filter((value): value is CustomParagraphElement => isCustomParagraph(value))

    const returnValue = paragraphs.reduce<StandardRender>((previous, item, index) => {
        const children = item.children.filter((child) => (!(Text.isText(child) && !child.text)))
        const paragraphResult = children.reduce<StandardRender>((accumulator, child, childIndex) => {
            if (isCustomLink(child)) {
                const text = child.children
                    .filter((item) => ('text' in item))
                    .map(({ text }) => (text))
                    .join('')
                const merged = accumulator.merge(new StandardRender([{ data: { tag: 'Link', to: child.to, text }, children: [] }]))
                return merged ?? accumulator
            }
            if ('text' in child) {
                const nextChild = children[childIndex + 1]
                const prevChild = childIndex > 0 ? children[childIndex - 1] : undefined
                const boundary = nextChild && isCustomLink(nextChild)
                    ? 'beforeLink'
                    : prevChild && isCustomLink(prevChild)
                        ? 'afterLink'
                        : 'none'
                return mergeRenderSeeds(accumulator, textToRenderSeeds(child.text, boundary))
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
