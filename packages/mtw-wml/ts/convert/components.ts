import { isParseAfter, isParseBefore, isParseBookmark, isParseDescription, isParseFeature, isParseKnowledge, isParseMap, isParseMessage, isParseMoment, isParseName, isParseReplace, isParseRoom, ParseAfterTag, ParseBeforeTag, ParseBookmarkTag, ParseDescriptionTag, ParseException, ParseFeatureLegalContents, ParseFeatureTag, ParseKnowledgeLegalContents, ParseKnowledgeTag, ParseMapLegalContents, ParseMapTag, ParseMessageTag, ParseMomentTag, ParseNameTag, ParseReplaceTag, ParseRoomLegalContents, ParseRoomTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseTaggedMessageLegalContents } from "../parser/baseClasses"
import { isSchemaAfter, isSchemaBefore, isSchemaBookmark, isSchemaDescription, isSchemaFeature, isSchemaFeatureContents, isSchemaFeatureIncomingContents, isSchemaImage, isSchemaKnowledge, isSchemaKnowledgeContents, isSchemaKnowledgeIncomingContents, isSchemaMap, isSchemaMapContents, isSchemaMessage, isSchemaMoment, isSchemaName, isSchemaReplace, isSchemaRoom, isSchemaRoomContents, isSchemaRoomIncomingContents, isSchemaTaggedMessageLegalContents, SchemaAfterTag, SchemaBeforeTag, SchemaBookmarkTag, SchemaConditionTag, SchemaDescriptionTag, SchemaFeatureTag, SchemaKnowledgeTag, SchemaMapLegalContents, SchemaMapTag, SchemaMessageTag, SchemaMomentTag, SchemaNameTag, SchemaReplaceTag, SchemaRoomLegalContents, SchemaRoomTag, SchemaTag, SchemaTaggedMessageIncomingContents } from "../schema/baseClasses"
import { translateTaggedMessageContents } from "../schema/taggedMessage"
import { extractConditionedItemFromContents, extractDescriptionFromContents, extractNameFromContents } from "../schema/utils"
import { schemaDescriptionToWML } from "./description"
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn, SchemaToWMLOptions } from "./functionMixins"
import { tagRender } from "./utils/tagRender"
import { mergeOrderedConditionalTrees } from "./utils/orderedConditionalTree"

export const ParseComponentsMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseComponentsMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Description'>): ParseStackTagEntry<ParseDescriptionTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'After'>): ParseStackTagEntry<ParseAfterTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Before'>): ParseStackTagEntry<ParseBeforeTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Replace'>): ParseStackTagEntry<ParseReplaceTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Name'>): ParseStackTagEntry<ParseNameTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Room'>): ParseStackTagEntry<ParseRoomTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Feature'>): ParseStackTagEntry<ParseFeatureTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Knowledge'>): ParseStackTagEntry<ParseKnowledgeTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Map'>): ParseStackTagEntry<ParseMapTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Bookmark'>): ParseStackTagEntry<ParseBookmarkTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Message'>): ParseStackTagEntry<ParseMessageTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Moment'>): ParseStackTagEntry<ParseMomentTag>
        override parseConvert(value: MixinInheritedParseParameters<C>
            | ParseTagFactoryPropsLimited<'Description'>
            | ParseTagFactoryPropsLimited<'After'>
            | ParseTagFactoryPropsLimited<'Before'>
            | ParseTagFactoryPropsLimited<'Replace'>
            | ParseTagFactoryPropsLimited<'Name'>
            | ParseTagFactoryPropsLimited<'Room'>
            | ParseTagFactoryPropsLimited<'Feature'>
            | ParseTagFactoryPropsLimited<'Knowledge'>
            | ParseTagFactoryPropsLimited<'Map'>
            | ParseTagFactoryPropsLimited<'Bookmark'>
            | ParseTagFactoryPropsLimited<'Message'>
            | ParseTagFactoryPropsLimited<'Moment'>
            ): MixinInheritedParseReturn<C>
            | ParseStackTagEntry<ParseDescriptionTag>
            | ParseStackTagEntry<ParseAfterTag>
            | ParseStackTagEntry<ParseBeforeTag>
            | ParseStackTagEntry<ParseReplaceTag>
            | ParseStackTagEntry<ParseNameTag>
            | ParseStackTagEntry<ParseRoomTag>
            | ParseStackTagEntry<ParseFeatureTag>
            | ParseStackTagEntry<ParseKnowledgeTag>
            | ParseStackTagEntry<ParseMapTag>
            | ParseStackTagEntry<ParseBookmarkTag>
            | ParseStackTagEntry<ParseMessageTag>
            | ParseStackTagEntry<ParseMomentTag>
            {
            //
            // Convert Description tag-opens
            //
            if (isTypedParseTagOpen('Description')(value)) {
                return parseConverterMixin<ParseDescriptionTag, ParseTaggedMessageLegalContents>({
                    tag: 'Description',
                    properties: {
                        required: {},
                        optional: {}
                    },
                    contents: {
                        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf', 'After', 'Before', 'Replace'],
                        ignore: ['Comment']
                    }
                })(value)
            }
            //
            // Convert After tag-opens
            //
            if (isTypedParseTagOpen('After')(value)) {
                return parseConverterMixin<ParseAfterTag, ParseTaggedMessageLegalContents>({
                    tag: 'After',
                    properties: {
                        required: {},
                        optional: {}
                    },
                    contents: {
                        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf', 'After', 'Before', 'Replace'],
                        ignore: ['Comment']
                    }
                })(value)
            }
            //
            // Convert Before tag-opens
            //
            if (isTypedParseTagOpen('Before')(value)) {
                return parseConverterMixin<ParseBeforeTag, ParseTaggedMessageLegalContents>({
                    tag: 'Before',
                    properties: {
                        required: {},
                        optional: {}
                    },
                    contents: {
                        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf', 'After', 'Before', 'Replace'],
                        ignore: ['Comment']
                    }
                })(value)
            }
            //
            // Convert Replace tag-opens
            //
            if (isTypedParseTagOpen('Replace')(value)) {
                return parseConverterMixin<ParseReplaceTag, ParseTaggedMessageLegalContents>({
                    tag: 'Replace',
                    properties: {
                        required: {},
                        optional: {}
                    },
                    contents: {
                        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf', 'After', 'Before', 'Replace'],
                        ignore: ['Comment']
                    }
                })(value)
            }
            //
            // Convert Name tag-opens
            //
            else if (isTypedParseTagOpen('Name')(value)) {
                return parseConverterMixin<ParseNameTag, ParseTaggedMessageLegalContents>({
                    tag: 'Name',
                    properties: {
                        required: {},
                        optional: {}
                    },
                    contents: {
                        legal: ['Whitespace', 'String', 'Space', 'After', 'Before', 'Replace'],
                        ignore: ['Comment']
                    }
                })(value)
            }
            //
            // Convert Room tag-opens
            //
            else if (isTypedParseTagOpen('Room')(value)) {
                return parseConverterMixin<ParseRoomTag, ParseRoomLegalContents>({
                    tag: 'Room',
                    properties: {
                        required: (context) => {
                            if (context.map(({ tag }) => (tag)).includes('Map')) {
                                return {
                                    key: ['key'],
                                    x: ['literal'],
                                    y: ['literal']
                                }
                            }
                            else {
                                return {
                                    key: ['key']
                                }
                            }
                        },
                        optional: (context) => {
                            if (context.find(({ tag }) => (['Asset', 'Story'].includes(tag)))) {
                                return {}
                            }
                            else {
                                return {
                                    x: ['literal'],
                                    y: ['literal']
                                }
                            }
                        }
                    },
                    contents: {
                        legal: ['Description', 'Name', 'Feature', 'Exit', 'If', 'Else', 'ElseIf'],
                        ignore: ['Whitespace', 'Comment']
                    },
                    postProcess: ({ context, properties, contents, startTagToken, endTagToken }) => {
                        if (context.map(({ tag }) => (tag)).includes('Map') || !context.find(({ tag }) => (['Asset', 'Story'].includes(tag)))) {
                            const x = properties.x ? parseInt(properties.x) : undefined
                            const y = properties.y ? parseInt(properties.y) : undefined
                            if (properties.x && Number.isNaN(x)) {
                                throw new ParseException(`Property 'x' in Room tag must be a number`, startTagToken, endTagToken)
                            }
                            if (properties.y && Number.isNaN(y)) {
                                throw new ParseException(`Property 'y' in Room tag must be a number`, startTagToken, endTagToken)
                            }
                            return {
                                x,
                                y,
                                contents
                            }
                        }
                        else {
                            return { contents }
                        }
                    }
                })(value)
            }
            //
            // Convert Feature tag-opens
            //
            else if (isTypedParseTagOpen('Feature')(value)) {
                return parseConverterMixin<ParseFeatureTag, ParseFeatureLegalContents>({
                    tag: 'Feature',
                    properties: {
                        required: {
                            key: ['key']
                        },
                        optional: {}
                    },
                    contents: {
                        legal: ['Name', 'Description', 'If', 'Else', 'ElseIf'],
                        ignore: ['Whitespace', 'Comment']
                    }
                })(value)
            }
            //
            // Convert Knowledge tag-opens
            //
            else if (isTypedParseTagOpen('Knowledge')(value)) {
                return parseConverterMixin<ParseKnowledgeTag, ParseKnowledgeLegalContents>({
                    tag: 'Knowledge',
                    properties: {
                        required: {
                            key: ['key']
                        },
                        optional: {}
                    },
                    contents: {
                        legal: ['Name', 'Description', 'If', 'Else', 'ElseIf'],
                        ignore: ['Whitespace', 'Comment']
                    }
                })(value)
            }
            //
            // Convert Map tag-opens
            //
            else if (isTypedParseTagOpen('Map')(value)) {
                return parseConverterMixin<ParseMapTag, ParseMapLegalContents>({
                    tag: 'Map',
                    properties: {
                        required: {
                            key: ['key']
                        },
                        optional: {}
                    },
                    contents: {
                        legal: ['Name', 'Room', 'Image', 'If', 'Else', 'ElseIf'],
                        ignore: ['Whitespace', 'Comment']
                    }
                })(value)
            }
            //
            // Convert Bookmark tag-opens
            //
            else if (isTypedParseTagOpen('Bookmark')(value)) {
                return parseConverterMixin<ParseBookmarkTag, ParseTaggedMessageLegalContents>({
                    tag: 'Bookmark',
                    properties: {
                        required: { key: ['key'] },
                        optional: {}
                    },
                    contents: {
                        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf'],
                        ignore: ['Comment']
                    }
                })(value)
            }
            //
            // Convert Message tag-opens
            //
            else if (isTypedParseTagOpen('Message')(value)) {
                return parseConverterMixin<ParseMessageTag, ParseTaggedMessageLegalContents | ParseRoomTag>({
                    tag: 'Message',
                    properties: {
                        required: { key: ['key'] },
                        optional: {}
                    },
                    contents: {
                        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf', 'Room'],
                        ignore: ['Comment']
                    }
                })(value)
            }
            //
            // Convert Moment tag-opens
            //
            else if (isTypedParseTagOpen('Moment')(value)) {
                return parseConverterMixin<ParseMomentTag, ParseMessageTag>({
                    tag: 'Moment',
                    properties: {
                        required: { key: ['key'] },
                        optional: {}
                    },
                    contents: {
                        legal: ['Message'],
                        ignore: ['Whitespace', 'Comment']
                    }
                })(value)
            }
            else {
                const returnValue = (super.parseConvert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedParseReturn<C>
            }
        }

        override schemaConvert(item: ParseDescriptionTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaDescriptionTag
        override schemaConvert(item: ParseAfterTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaAfterTag
        override schemaConvert(item: ParseBeforeTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaBeforeTag
        override schemaConvert(item: ParseReplaceTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaReplaceTag
        override schemaConvert(item: ParseNameTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaNameTag
        override schemaConvert(item: ParseRoomTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaRoomTag
        override schemaConvert(item: ParseFeatureTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaFeatureTag
        override schemaConvert(item: ParseKnowledgeTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaKnowledgeTag
        override schemaConvert(item: ParseBookmarkTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaBookmarkTag
        override schemaConvert(item: ParseMapTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaMapTag
        override schemaConvert(item: ParseMessageTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaMessageTag
        override schemaConvert(item: ParseMomentTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaMomentTag
        override schemaConvert(
                item: MixinInheritedSchemaParameters<C>
                    | ParseDescriptionTag
                    | ParseAfterTag
                    | ParseBeforeTag
                    | ParseReplaceTag
                    | ParseNameTag
                    | ParseRoomTag
                    | ParseFeatureTag
                    | ParseKnowledgeTag
                    | ParseBookmarkTag
                    | ParseMapTag
                    | ParseMessageTag
                    | ParseMomentTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C>
                    | SchemaTag[]
            ): MixinInheritedSchemaReturn<C>
                | SchemaDescriptionTag
                | SchemaAfterTag
                | SchemaBeforeTag
                | SchemaReplaceTag
                | SchemaNameTag
                | SchemaRoomTag
                | SchemaFeatureTag
                | SchemaKnowledgeTag
                | SchemaBookmarkTag
                | SchemaMapTag
                | SchemaMessageTag
                | SchemaMomentTag {
            if (isParseDescription(item)) {
                return {
                    tag: 'Description',
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
                }            
            }
            else if (isParseAfter(item)) {
                return {
                    tag: 'After',
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
                }            
            }
            else if (isParseBefore(item)) {
                return {
                    tag: 'Before',
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
                }            
            }
            else if (isParseReplace(item)) {
                return {
                    tag: 'Replace',
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
                }            
            }
            else if (isParseName(item)) {
                return {
                    tag: 'Name',
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[]),
                }            
            }
            else if (isParseRoom(item)) {
                const componentContents = (contents as SchemaTag[]).filter(isSchemaRoomContents)
                const translatedContents = (contents as SchemaTag[]).filter(isSchemaRoomIncomingContents)
                return {
                    tag: 'Room',
                    key: item.key,
                    display: item.display,
                    x: item.x,
                    y: item.y,
                    name: extractNameFromContents(translatedContents),
                    render: extractDescriptionFromContents(translatedContents),
                    contents: componentContents
                }            
            }
            else if (isParseFeature(item)) {
                const componentContents = (contents as SchemaTag[]).filter(isSchemaFeatureContents)
                const translatedContents = (contents as SchemaTag[]).filter(isSchemaFeatureIncomingContents)
                return {
                    tag: 'Feature',
                    key: item.key,
                    name: extractNameFromContents(translatedContents),
                    render: extractDescriptionFromContents(translatedContents),
                    contents: componentContents
                }            
            }
            else if (isParseKnowledge(item)) {
                const translatedContents = (contents as SchemaTag[]).filter(isSchemaKnowledgeIncomingContents)
                return {
                    tag: 'Knowledge',
                    key: item.key,
                    name: extractNameFromContents(translatedContents),
                    render: extractDescriptionFromContents(translatedContents),
                    contents: []
                }            
            }
            else if (isParseBookmark(item)) {
                return {
                    tag: 'Bookmark',
                    key: item.key,
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
                }            
            }
            else if (isParseMap(item)) {
                const componentContents = (contents as SchemaTag[]).filter(isSchemaMapContents)
                return {
                    tag: 'Map',
                    key: item.key,
                    name: extractNameFromContents(contents as SchemaMapLegalContents[]),
                    contents: componentContents,
                    rooms: extractConditionedItemFromContents({
                        contents: contents as SchemaMapLegalContents[],
                        typeGuard: isSchemaRoom,
                        transform: ({ key, x, y }) => ({ conditions: [], key, x, y })
                    }),
                    images: (contents as SchemaTag[]).filter(isSchemaImage).map(({ key }) => (key))
                }
            }
            else if (isParseMessage(item)) {
                const componentContents = (contents as SchemaTag[]).filter(isSchemaRoom)
                return {
                    tag: 'Message',
                    key: item.key,
                    render: (contents as SchemaTag[]).filter(isSchemaTaggedMessageLegalContents),
                    contents: componentContents,
                    rooms: (contents as SchemaTag[]).reduce((previous, room) => (
                        isSchemaRoom(room)
                            ? [
                                ...previous,
                                { key: room.key }
                            ]
                            : previous
                    ), [])
                }
            }
            else if (isParseMoment(item)) {
                const componentContents = (contents as SchemaTag[]).filter(isSchemaMessage)
                return {
                    tag: 'Moment',
                    key: item.key,
                    contents: componentContents
                }
            }
            else {
                const returnValue = (super.schemaConvert as any)(item, siblings, contents)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedSchemaReturn<C>
            }
        }

        override schemaToWML(value: SchemaTag, options: SchemaToWMLOptions): string {
            const schemaToWML = (value: SchemaTag, passedOptions: SchemaToWMLOptions) => (this.schemaToWML(value, { ...passedOptions, indent: options.indent + 1, context: [ ...options.context, value ] }))
            if (isSchemaDescription(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Description',
                    properties: [],
                    contents: value.contents,
                })
            }
            else if (isSchemaAfter(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'After',
                    properties: [],
                    contents: value.contents,
                })
            }
            else if (isSchemaBefore(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Before',
                    properties: [],
                    contents: value.contents,
                })
            }
            else if (isSchemaReplace(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Replace',
                    properties: [],
                    contents: value.contents,
                })
            }
            else if (isSchemaName(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Name',
                    properties: [],
                    contents: value.contents,
                })
            }
            else if (isSchemaRoom(value)) {
                const roomContents: SchemaTag[] = [
                    ...((value.name ?? []).length ? [{ tag: 'Name' as 'Name', contents: value.name}] : []),
                    ...((value.render ?? []).length ? [{ tag: 'Description' as 'Description', contents: value.render }] : []),
                    ...value.contents.filter((tag) => (!(isSchemaName(tag) || isSchemaDescription(tag))))
                ]
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Room',
                    properties: [
                        { key: 'key', type: 'key', value: value.key },
                        { key: 'x', type: 'literal', value: typeof value.x !== 'undefined' ? `${value.x}` : '' },
                        { key: 'y', type: 'literal', value: typeof value.y !== 'undefined' ? `${value.y}` : '' }
                    ],
                    contents: roomContents,
                })
            }
            else if (isSchemaFeature(value)) {
                const featureContents: SchemaTag[] = [
                    ...((value.name ?? []).length ? [{ tag: 'Name' as 'Name', contents: value.name}] : []),
                    ...((value.render ?? []).length ? [{ tag: 'Description' as 'Description', contents: value.render }] : []),
                    ...value.contents.filter((tag) => (!(isSchemaName(tag) || isSchemaDescription(tag))))
                ]
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Feature',
                    properties: [
                        { key: 'key', type: 'key', value: value.key }
                    ],
                    contents: featureContents,
                })
            }
            else if (isSchemaKnowledge(value)) {
                const knowledgeContents: SchemaTag[] = [
                    ...((value.name ?? []).length ? [{ tag: 'Name' as 'Name', contents: value.name}] : []),
                    ...((value.render ?? []).length ? [{ tag: 'Description' as 'Description', contents: value.render }] : []),
                    ...value.contents.filter((tag) => (!(isSchemaName(tag) || isSchemaDescription(tag))))
                ]
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Knowledge',
                    properties: [
                        { key: 'key', type: 'key', value: value.key }
                    ],
                    contents: knowledgeContents,
                })
            }
            else if (isSchemaBookmark(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Bookmark',
                    properties: [
                        { key: 'key', type: 'key', value: value.key },
                    ],
                    contents: value.contents,
                })
            }
            else if (isSchemaMap(value)) {
                const mapContents: SchemaTag[] = mergeOrderedConditionalTrees('Map')(
                        [
                            ...(value.name ? [{ tag: 'Name' as 'Name', contents: value.name}] : []),
                            ...((value.images || []).map((key) => ({ tag: 'Image' as 'Image', key,  contents: []}))),
                        ],
                        value.rooms.map((room) => ({
                            tag: 'If',
                            contextTag: 'Map',
                            conditions: room.conditions,
                            contents: [{
                                tag: 'Room',
                                key: room.key,
                                x: room.x,
                                y: room.y,
                                contents: []
                            }]
                        })) as SchemaConditionTag[]
                    )
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Map',
                    properties: [
                        { key: 'key', type: 'key', value: value.key },
                    ],
                    contents: mapContents,
                })
            }
            else if (isSchemaMessage(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Message',
                    properties: [
                        { key: 'key', type: 'key', value: value.key }
                    ],
                    contents: [
                        ...value.render,
                        ...(value.rooms.map(({ key }) => ({ tag: 'Room' as 'Room', key, name: [], render: [], contents: [] })))
                    ],
                })
            }
            else if (isSchemaMoment(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Moment',
                    properties: [
                        { key: 'key', type: 'key', value: value.key },
                    ],
                    contents: value.contents,
                })
            }
            else {
                const returnValue = (super.schemaToWML as any)(value, options)
                if (!(typeof returnValue === 'string')) {
                    throw new Error('Invalid parameter')
                }
                return returnValue
            }
        }
    }
}

export default ParseComponentsMixin
