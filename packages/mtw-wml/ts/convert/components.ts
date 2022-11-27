import { ParseBookmarkTag, ParseDescriptionTag, ParseException, ParseFeatureLegalContents, ParseFeatureTag, ParseMapLegalContents, ParseMapTag, ParseNameTag, ParseRoomLegalContents, ParseRoomTag, ParseTaggedMessageLegalContents } from "../parser/baseClasses";
import { BaseConverter, Constructor, SimpleParseConverterMixinFactory } from "./functionMixins";

const ParseNameMixin = SimpleParseConverterMixinFactory<ParseNameTag, ParseTaggedMessageLegalContents>({
    tag: 'Name',
    properties: {
        required: {},
        optional: {}
    },
    contents: {
        legal: ['Whitespace', 'String', 'Space'],
        ignore: ['Comment']
    }
})

const ParseDescriptionMixin = SimpleParseConverterMixinFactory<ParseDescriptionTag, ParseTaggedMessageLegalContents>({
    tag: 'Description',
    properties: {
        required: {},
        optional: {}
    },
    contents: {
        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf'],
        ignore: ['Comment']
    }
})

const ParseBookmarkMixin = SimpleParseConverterMixinFactory<ParseBookmarkTag, ParseTaggedMessageLegalContents>({
    tag: 'Bookmark',
    properties: {
        required: { key: ['key'] },
        optional: {}
    },
    contents: {
        legal: ['Whitespace', 'String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf'],
        ignore: ['Comment']
    }
})

const ParseFeatureMixin = SimpleParseConverterMixinFactory<ParseFeatureTag, ParseFeatureLegalContents>({
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
})

const ParseRoomMixin = SimpleParseConverterMixinFactory<ParseRoomTag, ParseRoomLegalContents>({
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
})

const ParseMapMixin = SimpleParseConverterMixinFactory<ParseMapTag, ParseMapLegalContents>({
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
})

export const ParseComponentsMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseMapMixin(
    ParseRoomMixin(
    ParseFeatureMixin(
    ParseBookmarkMixin(
    ParseDescriptionMixin(
    ParseNameMixin(
        Base
    ))))))
)

export default ParseComponentsMixin
