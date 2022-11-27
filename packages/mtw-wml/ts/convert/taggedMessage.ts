import { ParseLineBreakTag, ParseLinkLegalContents, ParseLinkTag, ParseSpacerTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, SimpleParseConverterMixinFactory } from "./functionMixins";

const ParseLineBreakMixin = SimpleParseConverterMixinFactory<ParseLineBreakTag, never>({
    tag: 'br',
    properties: {
        required: {},
        optional: {}
    }
})

const ParseSpaceMixin = SimpleParseConverterMixinFactory<ParseSpacerTag, never>({
    tag: 'Space',
    properties: {
        required: {},
        optional: {}
    }
})

const ParseLinkMixin = SimpleParseConverterMixinFactory<ParseLinkTag, ParseLinkLegalContents>({
    tag: 'Link',
    properties: {
        required: {
            to: ['key']
        },
        optional: {}
    },
    contents: {
        legal: ['Whitespace', 'String'],
        ignore: ['Comment']
    }
})

export const ParseTaggedMessageMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseLineBreakMixin(
    ParseSpaceMixin(
    ParseLinkMixin(
        Base
    )))
)

export default ParseTaggedMessageMixin
