import {
    ParseTag,
    isParseTagNesting,
    ParseAssetTag,
    ParseStoryTag,
    ParseCharacterTag,
    ParseNameTag,
    ParsePronounsTag,
    ParseOneCoolThingTag,
    ParseFirstImpressionTag,
    ParseOutfitTag,
    ParseImageTag,
    ParseVariableTag,
    ParseComputedTag,
    ParseActionTag,
    ParseUseTag,
    ParseImportTag,
    ParseConditionTag,
    ParseExitTag,
    ParseDescriptionTag,
    ParseLineBreakTag,
    ParseLinkTag,
    ParseRoomTag,
    ParseFeatureTag,
    ParseMapTag,
    ParseStringTag,
    ParseWhitespaceTag,
    ParseCommentTag,
    ParseAssetLegalContents,
    ParseCharacterLegalContents,
    ParseTaggedMessageLegalContents,
    ParseRoomLegalContents,
    ParseFeatureLegalContents,
    ParseMapLegalContents,
    ParseImportLegalContents,
    ParseSpacerTag,
    isParseConditionTagAssetContext,
    isParseConditionTagDescriptionContext,
    isParseConditionTagRoomContext,
    isParseConditionTagFeatureContext,
    isParseConditionTagMapContext,
    isParseElseTagMapContext,
    ParseElseTag,
    isParseElseTagAssetContext,
    isParseElseTagDescriptionContext,
    isParseElseTagRoomContext,
    isParseElseTagFeatureContext,
    ParseElseIfTag,
    isParseElseIfTagAssetContext,
    isParseElseIfTagMapContext,
    isParseElseIfTagFeatureContext,
    isParseElseIfTagRoomContext,
    isParseElseIfTagDescriptionContext,
    ParseBookmarkTag,
    ParseMessageLegalContents,
    ParseMessageTag,
    ParseMomentTag,
    ParseAfterTag,
    ParseBeforeTag,
    ParseReplaceTag
} from "../parser/baseClasses"
import { isSchemaCondition, isSchemaConditionTagFeatureContext, isSchemaConditionTagMapContext, isSchemaConditionTagRoomContext, isSchemaDescription, isSchemaName, isSchemaTag, SchemaConditionMixin, SchemaConditionTag, SchemaConditionTagRoomContext, SchemaException, SchemaFeatureLegalContents, SchemaMapLegalContents, SchemaMessageLegalContents, SchemaNameTag, SchemaRoomLegalContents, SchemaTag, SchemaTaggedMessageLegalContents } from "./baseClasses"

export function *depthFirstParseTagGenerator(tree: ParseTag[]): Generator<ParseTag> {
    for (const node of tree) {
        if (isParseTagNesting(node)) {
            yield* depthFirstParseTagGenerator(node.contents)
        }
        yield node
    }
}

export type TransformWithContextCallback = {
    (item: ParseAssetTag, context: ParseTag[]): ParseAssetTag;
    (item: ParseStoryTag, context: ParseTag[]): ParseStoryTag;
    (item: ParseCharacterTag, context: ParseTag[]): ParseCharacterTag;
    (item: ParseNameTag, context: ParseTag[]): ParseNameTag;
    (item: ParsePronounsTag, context: ParseTag[]): ParsePronounsTag;
    (item: ParseOneCoolThingTag, context: ParseTag[]): ParseOneCoolThingTag;
    (item: ParseFirstImpressionTag, context: ParseTag[]): ParseFirstImpressionTag;
    (item: ParseOutfitTag, context: ParseTag[]): ParseOutfitTag;
    (item: ParseImageTag, context: ParseTag[]): ParseImageTag;
    (item: ParseVariableTag, context: ParseTag[]): ParseVariableTag;
    (item: ParseComputedTag, context: ParseTag[]): ParseComputedTag;
    (item: ParseActionTag, context: ParseTag[]): ParseActionTag;
    (item: ParseUseTag, context: ParseTag[]): ParseUseTag;
    (item: ParseImportTag, context: ParseTag[]): ParseImportTag;
    (item: ParseConditionTag, context: ParseTag[]): ParseConditionTag;
    (item: ParseElseTag, context: ParseTag[]): ParseElseTag;
    (item: ParseElseIfTag, context: ParseTag[]): ParseElseIfTag;
    (item: ParseExitTag, context: ParseTag[]): ParseExitTag;
    (item: ParseDescriptionTag, context: ParseTag[]): ParseDescriptionTag;
    (item: ParseBookmarkTag, context: ParseTag[]): ParseBookmarkTag;
    (item: ParseMessageTag, context: ParseTag[]): ParseMessageTag;
    (item: ParseMomentTag, context: ParseTag[]): ParseMomentTag;
    (item: ParseLineBreakTag, context: ParseTag[]): ParseLineBreakTag;
    (item: ParseSpacerTag, context: ParseTag[]): ParseSpacerTag;
    (item: ParseLinkTag, context: ParseTag[]): ParseLinkTag;
    (item: ParseRoomTag, context: ParseTag[]): ParseRoomTag;
    (item: ParseFeatureTag, context: ParseTag[]): ParseFeatureTag;
    (item: ParseMapTag, context: ParseTag[]): ParseMapTag;
    (item: ParseStringTag, context: ParseTag[]): ParseStringTag;
    (item: ParseWhitespaceTag, context: ParseTag[]): ParseWhitespaceTag;
    (item: ParseCommentTag, context: ParseTag[]): ParseCommentTag;
    (item: ParseAfterTag, context: ParseTag[]): ParseAfterTag;
    (item: ParseBeforeTag, context: ParseTag[]): ParseBeforeTag;
    (item: ParseReplaceTag, context: ParseTag[]): ParseReplaceTag;
}

//
// Unfortunately, keeping the typechecking on legal contents for various parse tags requires repeating the same
// code over and over under each possible tag, to let typescript compile the separate cases individually
//
// TODO: Figure out a way to write the code once, and have Typescript not broaden the unions of types in compiling
//
export function transformWithContext(tree: ParseTag[], callback: TransformWithContextCallback, context: ParseTag[] = []): ParseTag[] {
    return tree.reduce<ParseTag[]>((previous, item) => {
        switch(item.tag) {
            case 'Asset':
                const assetItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...assetItem,
                        contents: transformWithContext(item.contents, callback, [...context, assetItem]) as ParseAssetLegalContents[]
                    }
                ]
            case 'Story':
                const storyItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...storyItem,
                        contents: transformWithContext(item.contents, callback, [...context, storyItem]) as ParseAssetLegalContents[]
                    }
                ]
            case 'Character':
                const characterItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...characterItem,
                        contents: transformWithContext(item.contents, callback, [...context, characterItem]) as ParseCharacterLegalContents[]
                    }
                ]
            case 'Name':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Pronouns':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'OneCoolThing':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'FirstImpression':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Outfit':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Image':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Variable':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Computed':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Action':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Use':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Import':
                const importItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...importItem,
                        contents: transformWithContext(item.contents, callback, [...context, importItem]) as ParseImportLegalContents[]
                    }
                ]
            case 'If':
                const conditionItem = callback(item, context)
                if (isParseConditionTagAssetContext(conditionItem)) {
                    return [
                        ...previous,
                        {
                            ...conditionItem,
                            contents: transformWithContext(item.contents, callback, [...context, conditionItem]) as ParseAssetLegalContents[]
                        }
                    ]
                }
                else if (isParseConditionTagDescriptionContext(conditionItem)) {
                    return [
                        ...previous,
                        {
                            ...conditionItem,
                            contents: transformWithContext(item.contents, callback, [...context, conditionItem]) as ParseTaggedMessageLegalContents[]
                        }
                    ]    
                }
                else if (isParseConditionTagRoomContext(conditionItem)) {
                    return [
                        ...previous,
                        {
                            ...conditionItem,
                            contents: transformWithContext(item.contents, callback, [...context, conditionItem]) as ParseRoomLegalContents[]
                        }
                    ]    
                }
                else if (isParseConditionTagFeatureContext(conditionItem)) {
                    return [
                        ...previous,
                        {
                            ...conditionItem,
                            contents: transformWithContext(item.contents, callback, [...context, conditionItem]) as ParseFeatureLegalContents[]
                        }
                    ]    
                }
                else if (isParseConditionTagMapContext(conditionItem)) {
                    return [
                        ...previous,
                        {
                            ...conditionItem,
                            contents: transformWithContext(item.contents, callback, [...context, conditionItem]) as ParseMapLegalContents[]
                        }
                    ]    
                }
                throw new SchemaException(`Invalid condition context`, conditionItem)
            case 'Else':
                const elseItem = callback(item, context)
                if (isParseElseTagAssetContext(elseItem)) {
                    return [
                        ...previous,
                        {
                            ...elseItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseItem]) as ParseAssetLegalContents[]
                        }
                    ]
                }
                else if (isParseElseTagDescriptionContext(elseItem)) {
                    return [
                        ...previous,
                        {
                            ...elseItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseItem]) as ParseTaggedMessageLegalContents[]
                        }
                    ]    
                }
                else if (isParseElseTagRoomContext(elseItem)) {
                    return [
                        ...previous,
                        {
                            ...elseItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseItem]) as ParseRoomLegalContents[]
                        }
                    ]    
                }
                else if (isParseElseTagFeatureContext(elseItem)) {
                    return [
                        ...previous,
                        {
                            ...elseItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseItem]) as ParseFeatureLegalContents[]
                        }
                    ]    
                }
                else if (isParseElseTagMapContext(elseItem)) {
                    return [
                        ...previous,
                        {
                            ...elseItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseItem]) as ParseMapLegalContents[]
                        }
                    ]    
                }
                throw new SchemaException(`Invalid else context`, elseItem)
            case 'ElseIf':
                const elseIfItem = callback(item, context)
                if (isParseElseIfTagAssetContext(elseIfItem)) {
                    return [
                        ...previous,
                        {
                            ...elseIfItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseIfItem]) as ParseAssetLegalContents[]
                        }
                    ]
                }
                else if (isParseElseIfTagDescriptionContext(elseIfItem)) {
                    return [
                        ...previous,
                        {
                            ...elseIfItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseIfItem]) as ParseTaggedMessageLegalContents[]
                        }
                    ]    
                }
                else if (isParseElseIfTagRoomContext(elseIfItem)) {
                    return [
                        ...previous,
                        {
                            ...elseIfItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseIfItem]) as ParseRoomLegalContents[]
                        }
                    ]    
                }
                else if (isParseElseIfTagFeatureContext(elseIfItem)) {
                    return [
                        ...previous,
                        {
                            ...elseIfItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseIfItem]) as ParseFeatureLegalContents[]
                        }
                    ]    
                }
                else if (isParseElseIfTagMapContext(elseIfItem)) {
                    return [
                        ...previous,
                        {
                            ...elseIfItem,
                            contents: transformWithContext(item.contents, callback, [...context, elseIfItem]) as ParseMapLegalContents[]
                        }
                    ]    
                }
                throw new SchemaException(`Invalid elseIf context`, elseIfItem)
            case 'Exit':
                const exitItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...exitItem,
                        contents: transformWithContext(item.contents, callback, [...context, exitItem]) as ParseStringTag[]
                    }
                ]
            case 'Description':
                const descriptionItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...descriptionItem,
                        contents: transformWithContext(item.contents, callback, [...context, descriptionItem]) as ParseTaggedMessageLegalContents[]
                    }
                ]
            case 'Bookmark':
                const bookmarkItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...bookmarkItem,
                        contents: transformWithContext(item.contents, callback, [...context, bookmarkItem]) as ParseTaggedMessageLegalContents[]
                    }
                ]
            case 'br':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Space':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Link':
                const linkItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...linkItem,
                        contents: transformWithContext(item.contents, callback, [...context, linkItem]) as ParseStringTag[]
                    }
                ]
            case 'Room':
                const roomItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...roomItem,
                        contents: transformWithContext(item.contents, callback, [...context, roomItem]) as ParseRoomLegalContents[]
                    }
                ]
            case 'Feature':
                const featureItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...featureItem,
                        contents: transformWithContext(item.contents, callback, [...context, featureItem]) as ParseFeatureLegalContents[]
                    }
                ]
            case 'Map':
                const mapItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...mapItem,
                        contents: transformWithContext(item.contents, callback, [...context, mapItem]) as ParseMapLegalContents[]
                    }
                ]
            case 'Message':
                const messageItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...messageItem,
                        contents: transformWithContext(item.contents, callback, [...context, messageItem]) as ParseMessageLegalContents[]
                    }
                ]
            case 'Moment':
                const momentItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...momentItem,
                        contents: transformWithContext(item.contents, callback, [...context, momentItem]) as ParseMessageTag[]
                    }
                ]
            case 'String':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Whitespace':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'Comment':
                return [
                    ...previous,
                    callback(item, context)
                ]
            case 'After':
                const afterItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...afterItem,
                        contents: transformWithContext(item.contents, callback, [...context, afterItem]) as ParseTaggedMessageLegalContents[]
                    }
                ]
            case 'Before':
                const beforeItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...beforeItem,
                        contents: transformWithContext(item.contents, callback, [...context, beforeItem]) as ParseTaggedMessageLegalContents[]
                    }
                ]
            case 'Replace':
                const replaceItem = callback(item, context)
                return [
                    ...previous,
                    {
                        ...replaceItem,
                        contents: transformWithContext(item.contents, callback, [...context, replaceItem]) as ParseTaggedMessageLegalContents[]
                    }
                ]
        }
        return [
            ...previous,
            callback(item, context)
        ]
    }, [])
}

export const extractNameFromContents = <T extends SchemaFeatureLegalContents | SchemaRoomLegalContents | SchemaMapLegalContents>(contents: T[]): SchemaTaggedMessageLegalContents[] => {
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

export const extractDescriptionFromContents = <T extends SchemaFeatureLegalContents | SchemaRoomLegalContents | SchemaMapLegalContents>(contents: T[]): SchemaTaggedMessageLegalContents[] => {
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
