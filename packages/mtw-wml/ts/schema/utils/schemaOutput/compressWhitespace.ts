import { GenericTree, GenericTreeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag, SchemaTaggedMessageLegalContents } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaDoubleBR, isSchemaDoubleSpace, isSchemaLineBreak, isSchemaSpacer, isSchemaString, SchemaDoubleBRTag, SchemaDoubleSpaceTag, SchemaLineBreakTag, SchemaSpacerTag } from "@tonylb/mtw-base/ts/schema/renderTree"

type WhitespaceRunTag = SchemaSpacerTag | SchemaLineBreakTag | SchemaDoubleSpaceTag | SchemaDoubleBRTag

const isWhitespaceRunTag = (tag: SchemaTag): tag is WhitespaceRunTag => (
    isSchemaSpacer(tag) || isSchemaLineBreak(tag) || isSchemaDoubleSpace(tag) || isSchemaDoubleBR(tag)
)

type SpaceFlushContext = 'before-br' | 'after-br' | 'mid-line'

const compressWhitespaceRun = (run: WhitespaceRunTag[]): GenericTree<SchemaTag> => {
    if (run.length === 0) {
        return []
    }

    const result: GenericTree<SchemaTag> = []
    let spaceCount = 0
    let brCount = 0
    let spacesAfterBr = false

    const flushSpaces = (context: SpaceFlushContext) => {
        if (spaceCount === 0) {
            return
        }
        if (context === 'mid-line' && spaceCount >= 2) {
            result.push({ data: { tag: 'DoubleSpace' }, children: [] })
        }
        else if (spaceCount >= 1) {
            result.push({ data: { tag: 'Space' }, children: [] })
        }
        spaceCount = 0
        spacesAfterBr = false
    }

    const flushBr = () => {
        if (brCount >= 2) {
            result.push({ data: { tag: 'DoubleBR' }, children: [] })
            spacesAfterBr = true
        }
        else if (brCount === 1) {
            result.push({ data: { tag: 'br' }, children: [] })
            spacesAfterBr = true
        }
        brCount = 0
    }

    run.forEach((tag) => {
        if (isSchemaDoubleSpace(tag)) {
            flushBr()
            flushSpaces('mid-line')
            result.push({ data: { tag: 'DoubleSpace' }, children: [] })
        }
        else if (isSchemaDoubleBR(tag)) {
            flushSpaces(spacesAfterBr ? 'after-br' : 'mid-line')
            flushBr()
            result.push({ data: { tag: 'DoubleBR' }, children: [] })
        }
        else if (isSchemaLineBreak(tag)) {
            flushSpaces('before-br')
            brCount += 1
        }
        else if (isSchemaSpacer(tag)) {
            flushBr()
            spaceCount += 1
        }
    })

    flushBr()
    flushSpaces(spacesAfterBr ? 'after-br' : 'mid-line')
    return result
}

export function compressWhitespace (tags: GenericTree<SchemaTag>, options?: { messageParsing: boolean }): GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag>
export function compressWhitespace (tags: GenericTree<SchemaTag>, options?: { messageParsing: boolean }): GenericTree<SchemaTag> {
    //
    // First, compress all explicit whitespace items that are adjacent
    //
    const { accumulator, maybeCurrent } = tags.reduce<{ accumulator: GenericTree<SchemaTag>, maybeCurrent: WhitespaceRunTag[] }>((previous, { data: tag, children }) => {
        if (isWhitespaceRunTag(tag)) {
            return { ...previous, maybeCurrent: [...previous.maybeCurrent, tag] }
        }
        const flushedWhitespace = compressWhitespaceRun(previous.maybeCurrent)
        return {
            accumulator: [...previous.accumulator, ...flushedWhitespace, { data: tag, children }],
            maybeCurrent: []
        }
    }, { accumulator: [], maybeCurrent: [] })

    //
    // Now trim all strings appropriately
    //
    return [...accumulator, ...compressWhitespaceRun(maybeCurrent)].map(({ data: tag, children }, index, allTags): GenericTree<SchemaTag> => {
        const previous = index > 0 ? allTags[index - 1].data : undefined
        const next = index < allTags.length - 1 ? allTags[index + 1].data : undefined
        if (isSchemaString(tag)) {
            let returnValue = tag.value
            const trimStartNeighbor = !previous ||
                isSchemaSpacer(previous) ||
                isSchemaDoubleSpace(previous) ||
                isSchemaLineBreak(previous) ||
                isSchemaDoubleBR(previous) ||
                (options?.messageParsing && isSchemaRoom(previous))
            const trimEndNeighbor = !next ||
                isSchemaSpacer(next) ||
                isSchemaDoubleSpace(next) ||
                isSchemaLineBreak(next) ||
                isSchemaDoubleBR(next) ||
                (options?.messageParsing && isSchemaRoom(next))
            if (trimStartNeighbor) {
                returnValue = returnValue.trimStart()
            }
            if (trimEndNeighbor) {
                returnValue = returnValue.trimEnd()
            }
            if (!returnValue) {
                return []
            }
            return [{ data: { ...tag, value: returnValue }, children: [] }]
        }
        return [{ data: tag, children }]
    }).flat(1)
}
