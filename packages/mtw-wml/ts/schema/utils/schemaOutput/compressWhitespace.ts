import { GenericTree, GenericTreeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag, SchemaTaggedMessageLegalContents } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaLineBreak, isSchemaSpacer, isSchemaString, SchemaLineBreakTag, SchemaSpacerTag } from "@tonylb/mtw-base/ts/schema/renderTree"

const MAX_CONSECUTIVE_BR = 2

const compressWhitespaceRun = (run: (SchemaSpacerTag | SchemaLineBreakTag)[]): GenericTree<SchemaTag> => {
    if (run.length === 0) {
        return []
    }
    const result: GenericTree<SchemaTag> = []
    let pendingSpace = false
    let brCount = 0

    const flushPendingSpace = () => {
        if (pendingSpace) {
            result.push({ data: { tag: 'Space' }, children: [] })
            pendingSpace = false
        }
    }

    run.forEach((tag) => {
        if (isSchemaLineBreak(tag)) {
            if (brCount >= MAX_CONSECUTIVE_BR) {
                return
            }
            flushPendingSpace()
            result.push({ data: { tag: 'br' }, children: [] })
            brCount += 1
        }
        else if (isSchemaSpacer(tag)) {
            pendingSpace = true
        }
    })

    if (brCount === 0) {
        return pendingSpace ? [{ data: { tag: 'Space' }, children: [] }] : []
    }

    flushPendingSpace()
    return result
}

export function compressWhitespace (tags: GenericTree<SchemaTag>, options?: { messageParsing: boolean }): GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag>
export function compressWhitespace (tags: GenericTree<SchemaTag>, options?: { messageParsing: boolean }): GenericTree<SchemaTag> {
    //
    // First, compress all explicit whitespace items that are adjacent
    //
    const { accumulator, maybeCurrent } = tags.reduce<{ accumulator: GenericTree<SchemaTag>, maybeCurrent: (SchemaSpacerTag | SchemaLineBreakTag)[] }>((previous, { data: tag, children }) => {
        if (isSchemaSpacer(tag) || isSchemaLineBreak(tag)) {
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
            if (!previous || isSchemaSpacer(previous) || isSchemaLineBreak(previous) || (options?.messageParsing && isSchemaRoom(previous))) {
                returnValue = returnValue.trimStart()
            }
            if (!next || isSchemaSpacer(next) || isSchemaLineBreak(next) || (options?.messageParsing && isSchemaRoom(next))) {
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
