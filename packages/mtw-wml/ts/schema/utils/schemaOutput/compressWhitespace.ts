import { GenericTree, GenericTreeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag, SchemaTaggedMessageLegalContents } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaLineBreak, isSchemaSpacer, isSchemaString, SchemaLineBreakTag, SchemaSpacerTag } from "@tonylb/mtw-base/ts/schema/renderTree"

type WhitespaceRunState = {
    seenBr: boolean
    spaceBeforeBr: boolean
    spaceAfterBr: boolean
}

const compressWhitespaceRun = (run: (SchemaSpacerTag | SchemaLineBreakTag)[]): GenericTree<SchemaTag> => {
    if (run.length === 0) {
        return []
    }
    const { seenBr, spaceBeforeBr, spaceAfterBr } = run.reduce<WhitespaceRunState>(
        (state, tag) => {
            if (isSchemaLineBreak(tag)) {
                return { ...state, seenBr: true }
            }
            if (isSchemaSpacer(tag)) {
                return state.seenBr
                    ? { ...state, spaceAfterBr: true }
                    : { ...state, spaceBeforeBr: true }
            }
            return state
        },
        { seenBr: false, spaceBeforeBr: false, spaceAfterBr: false }
    )
    if (!seenBr) {
        return spaceBeforeBr ? [{ data: { tag: 'Space' }, children: [] }] : []
    }
    return [
        ...(spaceBeforeBr ? [{ data: { tag: 'Space' as const }, children: [] as [] }] : []),
        { data: { tag: 'br' as const }, children: [] },
        ...(spaceAfterBr ? [{ data: { tag: 'Space' as const }, children: [] as [] }] : []),
    ]
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
