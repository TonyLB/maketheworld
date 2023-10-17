import {
    ParseTag,
    isParseTagNesting
} from "../parser/baseClasses"
import { isSchemaCondition, isSchemaConditionTagFeatureContext, isSchemaConditionTagKnowledgeContext, isSchemaConditionTagMapContext, isSchemaConditionTagRoomContext, isSchemaDescription, isSchemaName, isSchemaTag, SchemaConditionMixin, SchemaConditionTag, SchemaConditionTagRoomContext, SchemaException, SchemaFeatureLegalContents, SchemaKnowledgeLegalContents, SchemaMapLegalContents, SchemaMessageLegalContents, SchemaNameTag, SchemaRoomLegalContents, SchemaTag, SchemaTaggedMessageLegalContents } from "./baseClasses"

export function *depthFirstParseTagGenerator(tree: ParseTag[]): Generator<ParseTag> {
    for (const node of tree) {
        if (isParseTagNesting(node)) {
            yield* depthFirstParseTagGenerator(node.contents)
        }
        yield node
    }
}

export const extractNameFromContents = <T extends SchemaFeatureLegalContents | SchemaKnowledgeLegalContents | SchemaRoomLegalContents | SchemaMapLegalContents>(contents: T[]): SchemaTaggedMessageLegalContents[] => {
    return contents.reduce<SchemaTaggedMessageLegalContents[]>((previous, item) => {
        if (isSchemaName(item)) {
            return [
                ...previous,
                ...(item.contents)
            ]
        }
        if (isSchemaCondition(item)) {
            if (isSchemaConditionTagRoomContext(item)) {
                const contents = extractNameFromContents(item.contents)
                if (contents.length) {
                    const conditionGroup = {
                        ...item,
                        contextTag: 'Name',
                        contents
                    } as SchemaTaggedMessageLegalContents
                    return [
                        ...previous,
                        conditionGroup
                    ]
                }
            }
            if (isSchemaConditionTagFeatureContext(item)) {
                const contents = extractNameFromContents(item.contents)
                if (contents.length) {
                    const conditionGroup = {
                        ...item,
                        contextTag: 'Name',
                        contents
                    } as SchemaTaggedMessageLegalContents
                    return [
                        ...previous,
                        conditionGroup
                    ]
                }
            }
            if (isSchemaConditionTagKnowledgeContext(item)) {
                const contents = extractNameFromContents(item.contents)
                if (contents.length) {
                    const conditionGroup = {
                        ...item,
                        contextTag: 'Name',
                        contents
                    } as SchemaTaggedMessageLegalContents
                    return [
                        ...previous,
                        conditionGroup
                    ]
                }
            }
            if (isSchemaConditionTagMapContext(item)) {
                const contents = extractNameFromContents(item.contents)
                if (contents.length) {
                    const conditionGroup = {
                        ...item,
                        contextTag: 'Name',
                        contents
                    } as SchemaTaggedMessageLegalContents
                    return [
                        ...previous,
                        conditionGroup
                    ]
                }
            }
        }
        return previous
    }, [])
}

export const extractDescriptionFromContents = <T extends SchemaFeatureLegalContents | SchemaKnowledgeLegalContents | SchemaRoomLegalContents | SchemaMapLegalContents>(contents: T[]): SchemaTaggedMessageLegalContents[] => {
    return contents.reduce<SchemaTaggedMessageLegalContents[]>((previous, item) => {
        if (isSchemaDescription(item)) {
            return [
                ...previous,
                ...(item.contents)
            ]
        }
        if (isSchemaCondition(item)) {
            if (isSchemaConditionTagRoomContext(item)) {
                const contents = extractDescriptionFromContents(item.contents)
                if (contents.length) {
                    const conditionGroup = {
                        ...item,
                        contextTag: 'Description',
                        contents
                    } as SchemaTaggedMessageLegalContents
                    return [
                        ...previous,
                        conditionGroup
                    ]
                }
            }
            if (isSchemaConditionTagFeatureContext(item)) {
                const contents = extractDescriptionFromContents(item.contents)
                if (contents.length) {
                    const conditionGroup = {
                        ...item,
                        contextTag: 'Description',
                        contents
                    } as SchemaTaggedMessageLegalContents
                    return [
                        ...previous,
                        conditionGroup
                    ]
                }
            }
            if (isSchemaConditionTagKnowledgeContext(item)) {
                const contents = extractDescriptionFromContents(item.contents)
                if (contents.length) {
                    const conditionGroup = {
                        ...item,
                        contextTag: 'Description',
                        contents
                    } as SchemaTaggedMessageLegalContents
                    return [
                        ...previous,
                        conditionGroup
                    ]
                }
            }
        }
        return previous
    }, [])
}

export const extractConditionedItemFromContents = <C extends SchemaMapLegalContents | SchemaMessageLegalContents | SchemaNameTag, T extends C, O extends SchemaConditionMixin>(props: {
    contents: C[];
    typeGuard: (value: C) => value is T;
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
            const nestedItems = extractConditionedItemFromContents({ contents: item.contents as C[], typeGuard, transform })
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
