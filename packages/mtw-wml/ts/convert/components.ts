import { ParseBookmarkTag, ParseDescriptionTag, ParseException, ParseFeatureLegalContents, ParseFeatureTag, ParseMapLegalContents, ParseMapTag, ParseNameTag, ParseRoomLegalContents, ParseRoomTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseTaggedMessageLegalContents } from "../parser/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn } from "./functionMixins";

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
    }
}

// export const ParseComponentsMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
//     ParseMapMixin(
//     ParseRoomMixin(
//     ParseFeatureMixin(
//     ParseBookmarkMixin(
//     ParseDescriptionMixin(
//     ParseNameMixin(
//         Base
//     ))))))
// )

export default ParseComponentsMixin
