import { ParseException, ParseFeatureLegalContents, ParseFeatureTag, ParseMapLegalContents, ParseMapTag, ParseRoomLegalContents, ParseRoomTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, SimpleParseConverterMixinFactory } from "./functionMixins";

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
        required: {
            key: ['key']
        },
        optional: {
            global: ['boolean'],
            x: ['literal'],
            y: ['literal']
        }
    },
    contents: {
        legal: ['Description', 'Name', 'Feature', 'Exit', 'If', 'Else', 'ElseIf'],
        ignore: ['Whitespace', 'Comment']
    },
    postProcess: ({ properties, contents, startTagToken, endTagToken }) => {
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
    ParseFeatureMixin(
    ParseRoomMixin(
    ParseMapMixin(
        Base
    )))
)

export default ParseComponentsMixin
