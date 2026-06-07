import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender, PlainClass } from "@tonylb/mtw-wml/ts/standardize/render"
import { CustomBlock, CustomFeatureLinkElement, CustomKnowledgeLinkElement } from "../baseClasses"
import { CustomParagraphContents, CustomParagraphElement } from "../baseClasses"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import { isSchemaDoubleBR, isSchemaLineBreak, isSchemaLink, isSchemaSpacer } from "@tonylb/mtw-base/ts/schema/renderTree"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"

const singleSpace = (s: string) => s.replace(/\s+/g, ' ')

/** Trim leading space from the first text node in paragraph children. */
const trimLeadingFromParagraphContents = (children: CustomParagraphContents[]): CustomParagraphContents[] => {
    if (children.length === 0) return []
    const first = children[0]
    if ('text' in first) {
        return [{ text: first.text.trimStart() }, ...children.slice(1)]
    }
    return children
}

/** Trim trailing space from the last text node in paragraph children. */
const trimTrailingFromParagraphContents = (children: CustomParagraphContents[]): CustomParagraphContents[] => {
    if (children.length === 0) return []
    const last = children[children.length - 1]
    if ('text' in last) {
        return [...children.slice(0, -1), { text: last.text.trimEnd() }]
    }
    return children
}

type TrimBoundaryOptions = { preserveLeading?: boolean; preserveTrailing?: boolean }

const trimParagraphBoundaries = (
    children: CustomParagraphContents[],
    options: TrimBoundaryOptions = {}
): CustomParagraphContents[] => {
    const { preserveLeading = false, preserveTrailing = false } = options
    const afterLeading = preserveLeading ? children : trimLeadingFromParagraphContents(children)
    return preserveTrailing ? afterLeading : trimTrailingFromParagraphContents(afterLeading)
}

const isSpacerElement = (el: RenderTree[number]): boolean =>
    typeof el !== 'string' && isSchemaSpacer(el.data)

const isBreakElement = (el: RenderTree[number] | undefined): boolean =>
    Boolean(el && typeof el !== 'string' && isSchemaLineBreak(el.data))

const hasSubstantiveContent = (renderTree: RenderTree): boolean =>
    renderTree.some((el) =>
        (typeof el === 'string' && el.trim().length > 0) ||
        (typeof el !== 'string' && isSchemaLink(el.data))
    )

const appendTrailingSpaceToParagraph = (children: CustomParagraphContents[]): CustomParagraphContents[] => {
    if (children.length === 0) {
        return [{ text: ' ' }]
    }
    const last = children[children.length - 1]
    if ('text' in last) {
        return [...children.slice(0, -1), { text: last.text + ' ' }]
    }
    return [...children, { text: ' ' }]
}

/** Reducer: append an item to the list, merging with the last element when both are text (single-whitespace). */
export const compactAppend = (list: CustomParagraphContents[], item: CustomParagraphContents): CustomParagraphContents[] => {
    if ('text' in item) {
        const normalized = singleSpace(item.text)
        const last = list[list.length - 1]
        if (list.length > 0 && 'text' in last) {
            const combined = singleSpace(last.text + item.text)
            return [...list.slice(0, -1), { text: combined }]
        }
        return [...list, { text: normalized }]
    }
    return [...list, item]
}

export const descendantsCompact = (items: CustomParagraphContents[]): CustomParagraphContents[] =>
    items.reduce(compactAppend, [])

export const descendantsFromRender = (render: StandardRender, options: { standard: StandardForm }): CustomBlock[] => {
    const payload = render._payload
    if (!(payload instanceof PlainClass) || !payload.plain) {
        return [{ type: 'paragraph', children: [{ text: '' }] }]
    }
    const renderTree: RenderTree = payload.plain.toJSON()
    const hasContent = hasSubstantiveContent(renderTree)
    const preserveLeadingOnFirstParagraph = hasContent && renderTree.length > 0 && isSpacerElement(renderTree[0])
    const preserveTrailingOnLastParagraph =
        hasContent && renderTree.length > 0 && isSpacerElement(renderTree[renderTree.length - 1])

    let paragraphs: CustomParagraphElement[] = []
    let currentChildren: CustomParagraphContents[] = []
    let preserveLeadingOnCurrentParagraph = false
    let preserveTrailingOnNextPush = false

    const pushParagraph = (isFinalFlush: boolean) => {
        const trimmed = trimParagraphBoundaries(currentChildren, {
            preserveLeading: (paragraphs.length === 0 && preserveLeadingOnFirstParagraph) || preserveLeadingOnCurrentParagraph,
            preserveTrailing: (isFinalFlush && preserveTrailingOnLastParagraph) || preserveTrailingOnNextPush
        })
        paragraphs = [...paragraphs, { type: 'paragraph', children: trimmed.length > 0 ? trimmed : [{ text: '' }] }]
        currentChildren = []
        preserveLeadingOnCurrentParagraph = false
        preserveTrailingOnNextPush = false
    }

    for (let index = 0; index < renderTree.length; index++) {
        const el = renderTree[index]
        const nextEl = renderTree[index + 1]
        const prevEl = index > 0 ? renderTree[index - 1] : undefined

        if (typeof el === 'string') {
            if (currentChildren.length === 0) {
                currentChildren = [{ text: singleSpace(el).trimStart() }]
            } else {
                currentChildren = compactAppend(currentChildren, { text: el })
            }
            continue
        }
        if (isSchemaLineBreak(el.data)) {
            pushParagraph(false)
            continue
        }
        if (isSchemaDoubleBR(el.data)) {
            pushParagraph(false)
            pushParagraph(false)
            continue
        }
        if (isSchemaSpacer(el.data)) {
            const spaceBeforeBr = isBreakElement(nextEl)
            const spaceAfterBr = isBreakElement(prevEl)
            const isDocStartSpacer = paragraphs.length === 0 && currentChildren.length === 0 && preserveLeadingOnFirstParagraph

            if (spaceBeforeBr) {
                currentChildren = appendTrailingSpaceToParagraph(currentChildren)
                preserveTrailingOnNextPush = true
                continue
            }
            if (spaceAfterBr || isDocStartSpacer) {
                preserveLeadingOnCurrentParagraph = true
                currentChildren = [{ text: ' ' }]
                continue
            }
            if (currentChildren.length === 0) {
                currentChildren = [{ text: singleSpace(' ').trimStart() }]
            } else {
                currentChildren = compactAppend(currentChildren, { text: ' ' })
            }
            continue
        }
        if (isSchemaLink(el.data)) {
            const linkTarget = options.standard.byId[el.data.to]
            currentChildren = [...currentChildren, {
                type: linkTarget instanceof StandardFeature ? 'featureLink' : 'knowledgeLink',
                to: el.data.to,
                children: [{
                    text: el.children.filter((child) => typeof child === 'string').join('') || el.data.text
                }]
            } as CustomFeatureLinkElement | CustomKnowledgeLinkElement]
            continue
        }
        throw new Error('Invalid render element')
    }

    if (paragraphs.length === 0 && currentChildren.length === 0) {
        return [{ type: 'paragraph', children: [{ text: '' }] }]
    }
    // Always flush the current paragraph so a trailing <br /> (empty paragraph in Slate) round-trips correctly.
    pushParagraph(true)
    return paragraphs
}

export default descendantsFromRender
