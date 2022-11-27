import { ParseImportTag, ParseUseTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, SimpleParseConverterMixinFactory } from "./functionMixins";

export const ParseUseMixin = SimpleParseConverterMixinFactory<ParseUseTag, never>({
    tag: 'Use',
    properties: {
        required: { key: ['key'] },
        optional: {
            as: ['key'],
            type: ['literal']
        }
    }
})

export const ParseImportTagMixin = SimpleParseConverterMixinFactory<ParseImportTag, ParseUseTag>({
    tag: 'Import',
    properties: {
        required: { from: ['key'] },
        optional: {}
    },
    contents: {
        legal: ['Use'],
        ignore: ['Whitespace', 'Comment']
    }
})

export const ParseImportMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseUseMixin(
    ParseImportTagMixin(
        Base
    ))
)

export default ParseImportMixin
