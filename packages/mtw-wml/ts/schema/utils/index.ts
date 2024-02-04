import { deepEqual } from "../../lib/objects"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, GenericTreeNodeFiltered } from "../../tree/baseClasses"
import {
    isSchemaCondition,
    isSchemaDescription,
    isSchemaName,
    isSchemaTag,
    SchemaConditionMixin,
    SchemaLineBreakTag,
    SchemaSpacerTag,
    SchemaTag,
    SchemaTaggedMessageLegalContents,
    isSchemaLineBreak,
    isSchemaSpacer,
    isSchemaString,
    isSchemaTaggedMessageLegalContents,
    isSchemaWhitespace,
    isSchemaAfter,
    isSchemaBefore,
    isSchemaReplace,
    isSchemaLink,
    isSchemaBookmark,
    isSchemaRoom,
    SchemaOutputTag
} from "../baseClasses"

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

export function compressStrings (tags: GenericTree<SchemaOutputTag>): GenericTree<SchemaOutputTag> {
    const translateToString = (tag: GenericTreeNode<SchemaOutputTag>): GenericTreeNode<SchemaOutputTag> => {
        const { data, children } = tag
        if (isSchemaSpacer(data)) {
            return { data: { tag: 'String', value: ' ' }, children }
        }
        else {
            return tag
        }
    }
    return tags.reduce<GenericTree<SchemaOutputTag>>((previous, tag) => {
        const last = previous.length ? previous.slice(-1)[0] : undefined
        if (!last) {
            return [translateToString(tag)]
        }
        const { data: lastData, children: lastChildren } = last
        const { data, children } = translateToString(tag)
        if (isSchemaString(data) && isSchemaString(lastData)) {
            const space = `${lastData.value.trimEnd()}${data.value.trimStart()}` !== `${lastData.value}${data.value}`
            return [
                ...previous.slice(0, -1),
                {
                    data: { tag: 'String', value: space ? `${lastData.value.trimEnd()} ${data.value.trimStart()}` : `${lastData.value}${data.value}` },
                    children: [...lastChildren, ...children]
                }
            ]
        }
        return [...previous, { data, children }]
    }, [])
}

export const extractNameFromContents = (contents: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    return contents.map((item) => {
        if (isSchemaName(item.data)) {
            return item.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data)))
        }
        if (isSchemaCondition(item.data)) {
            const children = extractNameFromContents(item.children)
            if (children.length) {
                const conditionGroup = {
                    ...item,
                    children
                } as GenericTreeNodeFiltered<SchemaTaggedMessageLegalContents, SchemaTag>
                return [conditionGroup]
            }
        }
        return []
    }).flat(1)
}

export const extractDescriptionFromContents = (contents: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    const returnValue = contents.map((item) => {
        if (isSchemaDescription(item.data)) {
            return item.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data)))
        }
        if (isSchemaCondition(item.data)) {
            const children = extractDescriptionFromContents(item.children)
            if (children.length) {
                const conditionGroup = {
                    ...item,
                    children
                } as GenericTreeNodeFiltered<SchemaTaggedMessageLegalContents, SchemaTag>
                return [conditionGroup]
            }
        }
        return []
    }).flat(1)
    return returnValue
}

export const extractConditionedItemFromContents = <T extends SchemaTag, O extends SchemaConditionMixin>(props: {
    children: GenericTree<SchemaTag>;
    typeGuard: (value: SchemaTag) => value is T;
    transform: (value: T, index: number) => O;
}): O[] => {
    const { children: contents, typeGuard, transform } = props
    return contents.reduce<O[]>((previous, item, index) => {
        if (typeGuard(item.data)) {
            return [
                ...previous,
                transform(item.data, index)
            ]
        }
        if (isSchemaTag(item.data)) {
            const { data, children } = item
            if (isSchemaCondition(data)) {
                const nestedItems = extractConditionedItemFromContents({ children, typeGuard, transform })
                    .map(({ conditions, ...rest }) => ({
                        conditions: [
                            ...data.conditions,
                            ...conditions
                        ],
                        ...rest
                    })) as O[]
                return [
                    ...previous,
                    ...nestedItems
                ]
            }
        }
        return previous
    }, [])
}

//
// Fold whitespace into TaggedMessage legal contents by appending or prepending it to String values
//
export const translateTaggedMessageContents = (contents: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    let returnValue: GenericTree<SchemaTag> = []
    let currentToken: GenericTreeNode<SchemaTag> | undefined
    contents.forEach((item) => {
        if (isSchemaWhitespace(item.data)) {
            if (currentToken) {
                if (isSchemaString(currentToken?.data)) {
                    currentToken = {
                        ...currentToken,
                        data: {
                            ...currentToken.data,
                            value: `${currentToken.data.value.trimEnd()} `
                        }
                    }
                }
                else {
                    returnValue.push(currentToken)
                    currentToken = {
                        data: {
                            tag: 'String',
                            value: ' '
                        },
                        children: []
                    }
                }
            }
        }
        if (isSchemaLineBreak(item.data) || isSchemaSpacer(item.data) || isSchemaLink(item.data) || isSchemaBookmark(item.data)) {
            if (currentToken) {
                returnValue.push(currentToken)
                currentToken = undefined
            }
            returnValue.push({ data: item.data, children: [] })
        }
        if (isSchemaString(item.data)) {
            if (currentToken) {
                if (isSchemaString(currentToken.data)) {
                    currentToken = {
                        ...currentToken,
                        data: {
                            ...currentToken.data,
                            value: `${currentToken.data.value}${item.data.value}`
                        }
                    }
                }
                else {
                    returnValue.push(currentToken)
                    currentToken = { data: item.data, children: [] }
                }
            }
            else {
                currentToken = { data: item.data, children: [] }
            }
        }
        if (isSchemaCondition(item.data) || isSchemaAfter(item.data) || isSchemaBefore(item.data) || isSchemaReplace(item.data)) {
            if (currentToken) {
                returnValue.push(currentToken)
            }
            currentToken = {
                data: item.data,
                children: translateTaggedMessageContents(item.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data))))
            }
        }
    })
    if (currentToken) {
        if (isSchemaString(currentToken.data)) {
            if (currentToken.data.value.trimEnd()) {
                returnValue.push({
                    data: {
                        ...currentToken.data,
                        value: currentToken.data.value.trimEnd()
                    },
                    children: translateTaggedMessageContents(currentToken.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data))))
                })
            }
        }
        else {
            returnValue.push({
                ...currentToken,
                children: translateTaggedMessageContents(currentToken.children.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data))))
            })
        }
    }
    return returnValue
}

//
// deIndentWML is a test utility that allows writing deeply indented WML (suitable for nesting in an indented code block)
// and then removing the common number of indents to left-justify the block.
//
export const deIndentWML = (wml: string): string => {
    const deIndentAmount = wml.split('\n').reduce<number>((previous, line) => {
        if (!line.trim()) {
            return previous
        }
        const lineIndent = line.length - line.trim().length
        return Math.min(lineIndent, previous)
    }, Infinity)
    if (deIndentAmount === Infinity || deIndentAmount === 0) {
        return wml
    }
    return wml
        .split('\n')
        .filter((line) => (Boolean(line.trim())))
        .map((line) => (line.slice(deIndentAmount)))
        .join('\n')
}