import { ParseException, ParseExitTag, ParseImageTag, ParseStringTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, SimpleParseConverterMixinFactory } from "./functionMixins";

export const ParseImageMixin = SimpleParseConverterMixinFactory<ParseImageTag, never>({
    tag: 'Image',
    properties: {
        required: { key: ['key'] },
        optional: { fileURL: ['literal'] }
    }
})

const ParseExitMixin = SimpleParseConverterMixinFactory<ParseExitTag, ParseStringTag>({
    tag: 'Exit',
    properties: {
        required: {},
        optional: {
            to: ['key'],
            from: ['key']
        }
    },
    contents: {
        legal: ['String'],
        ignore: ['Whitespace', 'Comment']
    },
    postProcess: ({ properties, contents, startTagToken, endTagToken }) => {
        if (!properties.to && !properties.from) {
            throw new ParseException(`Exit must include either a 'to' or 'from' property`, startTagToken, endTagToken)
        }
        return { contents }
    }
})

export const ParseMiscellaneousMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseImageMixin(
    ParseExitMixin(
        Base
    ))
)

export default ParseMiscellaneousMixin
