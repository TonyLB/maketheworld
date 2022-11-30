import { isParseBookmark, isParseDescription, isParseFeature, isParseMap, isParseName, isParseRoom, ParseBookmarkTag, ParseDescriptionTag, ParseException, ParseFeatureLegalContents, ParseFeatureTag, ParseMapLegalContents, ParseMapTag, ParseNameTag, ParseRoomLegalContents, ParseRoomTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseTaggedMessageLegalContents } from "../parser/baseClasses";
import { isSchemaFeatureContents, isSchemaFeatureIncomingContents, isSchemaImage, isSchemaMapContents, isSchemaRoom, isSchemaRoomContents, isSchemaRoomIncomingContents, SchemaBookmarkTag, SchemaDescriptionTag, SchemaFeatureTag, SchemaMapLegalContents, SchemaMapTag, SchemaNameTag, SchemaRoomLegalContents, SchemaRoomTag, SchemaTag, SchemaTaggedMessageIncomingContents } from "../schema/baseClasses";
import { translateTaggedMessageContents } from "../schema/taggedMessage";
import { extractConditionedItemFromContents, extractDescriptionFromContents, extractNameFromContents } from "../schema/utils";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn } from "./functionMixins";

export const ParseComponentsMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseComponentsMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Description'>): ParseStackTagEntry<ParseDescriptionTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Name'>): ParseStackTagEntry<ParseNameTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Room'>): ParseStackTagEntry<ParseRoomTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Feature'>): ParseStackTagEntry<ParseFeatureTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Map'>): ParseStackTagEntry<ParseMapTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Bookmark'>): ParseStackTagEntry<ParseBookmarkTag>
        override parseConvert(value: MixinInheritedParseParameters<C>
            | ParseTagFactoryPropsLimited<'Description'>
            | ParseTagFactoryPropsLimited<'Name'>
            | ParseTagFactoryPropsLimited<'Room'>
            | ParseTagFactoryPropsLimited<'Feature'>
            | ParseTagFactoryPropsLimited<'Map'>
            | ParseTagFactoryPropsLimited<'Bookmark'>
            ): MixinInheritedParseReturn<C>
            | ParseStackTagEntry<ParseDescriptionTag>
            | ParseStackTagEntry<ParseNameTag>
            | ParseStackTagEntry<ParseRoomTag>
            | ParseStackTagEntry<ParseFeatureTag>
            | ParseStackTagEntry<ParseMapTag>
            | ParseStackTagEntry<ParseBookmarkTag>
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
                        optional: {
                            global: ['boolean']
                        }
                    },
                    contents: {
                        legal: ['Description', 'Name', 'Feature', 'Exit', 'If', 'Else', 'ElseIf'],
                        ignore: ['Whitespace', 'Comment']
                    },
                    postProcess: ({ context, properties, contents, startTagToken, endTagToken }) => {
                        if (context.map(({ tag }) => (tag)).includes('Map')) {
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
                        legal: ['Name', 'Room', 'Exit', 'Image', 'If', 'Else', 'ElseIf'],
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
        override schemaConvert(
                item: MixinInheritedSchemaParameters<C>
                    | ParseDescriptionTag
                    | ParseNameTag
                    | ParseRoomTag
                    | ParseFeatureTag
                    | ParseBookmarkTag
                    | ParseMapTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C>
                    | SchemaTag[]
            ): MixinInheritedSchemaReturn<C>
                | SchemaDescriptionTag
                | SchemaNameTag
                | SchemaRoomTag
                | SchemaFeatureTag
                | SchemaBookmarkTag
                | SchemaMapTag {
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
                        transform: ({ key, x, y }, index) => ({ conditions: [], key, x, y, index })
                    }),
                    images: (contents as SchemaTag[]).filter(isSchemaImage).map(({ key }) => (key)),
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

    }
}

export default ParseComponentsMixin
