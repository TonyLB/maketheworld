import { GenericTree, GenericTreeFiltered } from "../../../tree/baseClasses"
import { SchemaLineBreakTag, SchemaSpacerTag, SchemaTag, SchemaTaggedMessageLegalContents, isSchemaLineBreak, isSchemaRoom, isSchemaSpacer, isSchemaString } from "../../baseClasses"

export function compressWhitespace (tags: GenericTree<SchemaTag>, options?: { messageParsing: boolean }): GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag>
export function compressWhitespace (tags: GenericTree<SchemaTag>, options?: { messageParsing: boolean }): GenericTree<SchemaTag> {
    //
    // First, compress all explicit whitespace items that are adjacent
    //
    const { accumulator, maybeCurrent } = tags.reduce<{ accumulator: GenericTree<SchemaTag>, maybeCurrent: (SchemaSpacerTag | SchemaLineBreakTag)[] }>((previous, { data: tag, children }) => {
        if (previous.maybeCurrent.length === 0) {
            if (isSchemaSpacer(tag) || isSchemaLineBreak(tag)) {
                return { ...previous, maybeCurrent: [tag] }
            }
            return {
                ...previous, accumulator: [...previous.accumulator, { data: tag, children }]
            }
        }
        const current = previous.maybeCurrent[0]
        if (isSchemaSpacer(tag) || isSchemaLineBreak(tag)) {
            if (isSchemaLineBreak(current) || isSchemaLineBreak(tag)) {
                return { ...previous, maybeCurrent: [{ tag: 'br' }] }
            }
            return { ...previous, maybeCurrent: [{ tag: 'Space' }] }
        }
        return {
            accumulator: [...previous.accumulator, { data: current, children: [] }, { data: tag, children }],
            maybeCurrent: []
        }
    }, { accumulator: [], maybeCurrent: [] })

    //
    // Now trim all strings appropriately
    //
    return [...accumulator, ...maybeCurrent.map((data) => ({ data, children: [] }))].map(({ data: tag, children }, index, allTags): GenericTree<SchemaTag> => {
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
