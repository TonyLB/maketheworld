import {
    isSchemaCondition,
    isSchemaDescription,
    isSchemaName,
    isSchemaTag,
    SchemaConditionMixin,
    SchemaMapLegalContents,
    SchemaMessageLegalContents,
    SchemaNameTag,
    SchemaLineBreakTag,
    SchemaSpacerTag,
    SchemaTag,
    SchemaTaggedMessageLegalContents,
    isSchemaLineBreak,
    isSchemaSpacer,
    isSchemaString,
    isSchemaTaggedMessageLegalContents
} from "./baseClasses"

export function compressWhitespace (tags: SchemaTaggedMessageLegalContents[]): SchemaTaggedMessageLegalContents[]
export function compressWhitespace (tags: SchemaTag[]): SchemaTag[] {
    //
    // First, compress all explicit whitespace items that are adjacent
    //
    const { accumulator, maybeCurrent } = tags.reduce<{ accumulator: SchemaTag[], maybeCurrent: (SchemaSpacerTag | SchemaLineBreakTag)[] }>((previous, tag) => {
        if (previous.maybeCurrent.length === 0) {
            if (isSchemaSpacer(tag) || isSchemaLineBreak(tag)) {
                return { ...previous, maybeCurrent: [tag] }
            }
            return {
                ...previous, accumulator: [...previous.accumulator, tag]
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
            accumulator: [...previous.accumulator, current, tag],
            maybeCurrent: []
        }
    }, { accumulator: [], maybeCurrent: [] })

    //
    // Now trim all strings appropriately
    //
    return [...accumulator, ...maybeCurrent].map((tag, index, allTags): SchemaTag[] => {
        const previous = index > 0 ? allTags[index - 1] : undefined
        const next = index < allTags.length - 1 ? allTags[index + 1] : undefined
        if (isSchemaString(tag)) {
            let returnValue = tag.value
            if (!previous || isSchemaSpacer(previous) || isSchemaLineBreak(previous)) {
                returnValue = returnValue.trimStart()
            }
            if (!next || isSchemaSpacer(next) || isSchemaLineBreak(next)) {
                returnValue = returnValue.trimEnd()
            }
            if (!returnValue) {
                return []
            }
            return [{ ...tag, value: returnValue }]
        }
        return [tag]
    }).flat(1)
}

export const extractNameFromContents = (contents: SchemaTag[]): SchemaTaggedMessageLegalContents[] => {
    return contents.map((item) => {
        if (isSchemaName(item)) {
            return item.contents.filter(isSchemaTaggedMessageLegalContents)
        }
        if (isSchemaCondition(item)) {
            const contents = extractNameFromContents(item.contents)
            if (contents.length) {
                const conditionGroup = {
                    ...item,
                    contents
                } as SchemaTaggedMessageLegalContents
                return [conditionGroup]
            }
        }
        return []
    }).flat(1)
}

export const extractDescriptionFromContents = (contents: SchemaTag[]): SchemaTaggedMessageLegalContents[] => {
    return contents.map((item) => {
        if (isSchemaDescription(item)) {
            return item.contents.filter(isSchemaTaggedMessageLegalContents)
        }
        if (isSchemaCondition(item)) {
            const contents = extractDescriptionFromContents(item.contents)
            if (contents.length) {
                const conditionGroup = {
                    ...item,
                    contents
                } as SchemaTaggedMessageLegalContents
                return [conditionGroup]
            }
        }
        return []
    }).flat(1)
}

export const extractConditionedItemFromContents = <T extends SchemaTag, O extends SchemaConditionMixin>(props: {
    contents: SchemaTag[];
    typeGuard: (value: SchemaTag) => value is T;
    transform: (value: T, index: number) => O;
}): O[] => {
    const { contents, typeGuard, transform } = props
    return contents.reduce<O[]>((previous, item, index) => {
        if (typeGuard(item)) {
            return [
                ...previous,
                transform(item, index)
            ]
        }
        if (isSchemaTag(item) && isSchemaCondition(item)) {
            const nestedItems = extractConditionedItemFromContents({ contents: item.contents, typeGuard, transform })
                .map(({ conditions, ...rest }) => ({
                    conditions: [
                        ...item.conditions,
                        ...conditions
                    ],
                    ...rest
                })) as O[]
            return [
                ...previous,
                ...nestedItems
            ]
        }
        return previous
    }, [])
}
