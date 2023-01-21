import { isParseBookmark, isParseDescription, isParseFeature, isParseMap, isParseMessage, isParseMoment, isParseName, isParseRoom, ParseBookmarkTag, ParseDescriptionTag, ParseException, ParseFeatureLegalContents, ParseFeatureTag, ParseMapLegalContents, ParseMapTag, ParseMessageTag, ParseMomentTag, ParseNameTag, ParseRoomLegalContents, ParseRoomTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseTaggedMessageLegalContents } from "../parser/baseClasses"
import { isSchemaBookmark, isSchemaDescription, isSchemaFeature, isSchemaFeatureContents, isSchemaFeatureIncomingContents, isSchemaImage, isSchemaMap, isSchemaMapContents, isSchemaMessage, isSchemaMoment, isSchemaName, isSchemaRoom, isSchemaRoomContents, isSchemaRoomIncomingContents, isSchemaTaggedMessageLegalContents, SchemaBookmarkTag, SchemaConditionTag, SchemaDescriptionTag, SchemaFeatureTag, SchemaMapLegalContents, SchemaMapTag, SchemaMessageTag, SchemaMomentTag, SchemaNameTag, SchemaRoomLegalContents, SchemaRoomTag, SchemaTag, SchemaTaggedMessageIncomingContents } from "../schema/baseClasses"
import { translateTaggedMessageContents } from "../schema/taggedMessage"
import { extractConditionedItemFromContents, extractDescriptionFromContents, extractNameFromContents } from "../schema/utils"
import { schemaDescriptionToWML } from "./description"
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn, SchemaToWMLOptions } from "./functionMixins"
import { tagRender } from "./utils/tagRender"
import { mergeOrderedConditionalTrees } from "./utils/orderedConditionalTree"

export const ParseComponentsMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseComponentsMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Description'>): ParseStackTagEntry<ParseDescriptionTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Name'>): ParseStackTagEntry<ParseNameTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Room'>): ParseStackTagEntry<ParseRoomTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Feature'>): ParseStackTagEntry<ParseFeatureTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Map'>): ParseStackTagEntry<ParseMapTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Bookmark'>): ParseStackTagEntry<ParseBookmarkTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Message'>): ParseStackTagEntry<ParseMessageTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Moment'>): ParseStackTagEntry<ParseMomentTag>
        override parseConvert(value: MixinInheritedParseParameters<C>
            | ParseTagFactoryPropsLimited<'Description'>
            | ParseTagFactoryPropsLimited<'Name'>
            | ParseTagFactoryPropsLimited<'Room'>
            | ParseTagFactoryPropsLimited<'Feature'>
            | ParseTagFactoryPropsLimited<'Map'>
            | ParseTagFactoryPropsLimited<'Bookmark'>
            | ParseTagFactoryPropsLimited<'Message'>
            | ParseTagFactoryPropsLimited<'Moment'>
            ): MixinInheritedParseReturn<C>
            | ParseStackTagEntry<ParseDescriptionTag>
            | ParseStackTagEntry<ParseNameTag>
            | ParseStackTagEntry<ParseRoomTag>
            | ParseStackTagEntry<ParseFeatureTag>
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
                        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf'],
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
                        legal: ['Whitespace', 'String', 'Space'],
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
                                return {
                                    global: ['boolean']
                                }
                            }
                            else {
                                return {
                                    global: ['boolean'],
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
                        optional: {
                            global: ['boolean']
                        }
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
        override schemaConvert(item: ParseNameTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaNameTag
        override schemaConvert(item: ParseRoomTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaRoomTag
        override schemaConvert(item: ParseFeatureTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaFeatureTag
        override schemaConvert(item: ParseBookmarkTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaBookmarkTag
        override schemaConvert(item: ParseMapTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaMapTag
        override schemaConvert(item: ParseMessageTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaMessageTag
        override schemaConvert(item: ParseMomentTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaMomentTag
        override schemaConvert(
                item: MixinInheritedSchemaParameters<C>
                    | ParseDescriptionTag
                    | ParseNameTag
                    | ParseRoomTag
                    | ParseFeatureTag
                    | ParseBookmarkTag
                    | ParseMapTag
                    | ParseMessageTag
                    | ParseMomentTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C>
                    | SchemaTag[]
            ): MixinInheritedSchemaReturn<C>
                | SchemaDescriptionTag
                | SchemaNameTag
                | SchemaRoomTag
                | SchemaFeatureTag
                | SchemaBookmarkTag
                | SchemaMapTag
                | SchemaMessageTag
                | SchemaMomentTag {
            if (isParseDescription(item)) {
                return {
                    tag: 'Description',
                    display: item.display,
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[]),
                    parse: item
                }            
            }
            else if (isParseName(item)) {
                return {
                    tag: 'Name',
                    parse: item,
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[]),
                }            
            }
            else if (isParseRoom(item)) {
                const componentContents = (contents as SchemaTag[]).filter(isSchemaRoomContents)
                const translatedContents = (contents as SchemaTag[]).filter(isSchemaRoomIncomingContents)
                return {
                    tag: 'Room',
                    key: item.key,
                    global: item.global,
                    display: item.display,
                    x: item.x,
                    y: item.y,
                    name: extractNameFromContents(translatedContents),
                    render: extractDescriptionFromContents(translatedContents),
                    contents: componentContents,
                    parse: item
                }            
            }
            else if (isParseFeature(item)) {
                const componentContents = (contents as SchemaTag[]).filter(isSchemaFeatureContents)
                const translatedContents = (contents as SchemaTag[]).filter(isSchemaFeatureIncomingContents)
                return {
                    tag: 'Feature',
                    key: item.key,
                    global: item.global,
                    name: extractNameFromContents(translatedContents),
                    render: extractDescriptionFromContents(translatedContents),
                    contents: componentContents,
                    parse: item
                }            
            }
            else if (isParseBookmark(item)) {
                return {
                    tag: 'Bookmark',
                    key: item.key,
                    display: item.display,
                    contents: translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[]),
                    parse: item
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
                    images: (contents as SchemaTag[]).filter(isSchemaImage).map(({ key }) => (key)),
                    parse: item
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
                    ), []),
                    parse: item
                }
            }
            else if (isParseMoment(item)) {
                const componentContents = (contents as SchemaTag[]).filter(isSchemaMessage)
                return {
                    tag: 'Moment',
                    key: item.key,
                    contents: componentContents,
                    parse: item
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
                        { key: 'global', type: 'boolean', value: value.global },
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
                        { key: 'key', type: 'key', value: value.key },
                        { key: 'global', type: 'boolean', value: value.global },
                    ],
                    contents: featureContents,
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
                        ...(value.rooms.map(({ key }) => ({ tag: 'Room' as 'Room', key, name: [], render: [], global: false, contents: [] })))
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
